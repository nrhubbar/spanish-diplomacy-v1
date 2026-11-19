import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { config, siteDomain } from "./config.ts";

export interface StaticSiteStackProps extends StackProps {
  /** Role that publishes build/dist; gets put and read on the bucket and invalidation on the distribution. */
  readonly publisherRoleName: string;
}

/**
 * Private S3 bucket behind CloudFront (origin access control), with its own DNS-validated
 * certificate and A/AAAA alias records in the existing hosted zone.
 *
 * Site content is not part of this stack: CI uploads build/dist with `aws s3 sync`, so a
 * content-only release never waits on CloudFormation.
 */
export class StaticSiteStack extends Stack {
  constructor(scope: Construct, id: string, props: StaticSiteStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", config.hostedZone);

    const bucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Every release is rebuilt from git, but keep the bucket if the stack is ever deleted.
      removalPolicy: RemovalPolicy.RETAIN
    });

    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: siteDomain,
      validation: acm.CertificateValidation.fromDns(zone)
    });

    // Directory URLs ("/assets/") serve their index.html, like the dev server does.
    const directoryIndex = new cloudfront.Function(this, "DirectoryIndex", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: "Rewrite directory URLs to index.html",
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (request.uri.endsWith("/")) request.uri += "index.html";
  return request;
}`)
    });

    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, "SecurityHeaders", {
      comment: "Spanish Diplomacy security headers",
      securityHeadersBehavior: {
        strictTransportSecurity: { accessControlMaxAge: Duration.days(730), includeSubdomains: true, override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true }
      }
    });

    // Freshness is set per object by Cache-Control at upload time (see infra/scripts/publish-site.sh):
    // hashed files under /assets/ are immutable, HTML is no-cache. CachingOptimized honours both.
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "Spanish Diplomacy game",
      domainNames: [siteDomain],
      certificate,
      defaultRootObject: "index.html",
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: securityHeaders,
        compress: true,
        functionAssociations: [{ function: directoryIndex, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }]
      }
    });

    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
    new route53.ARecord(this, "AliasA", { zone, recordName: config.subdomain, target });
    new route53.AaaaRecord(this, "AliasAAAA", { zone, recordName: config.subdomain, target });

    // Publishing needs to list, read, and put objects, and to invalidate the HTML. No delete:
    // old hashed chunks stay so a player mid-session can still lazy-load them after a release.
    const publisher = iam.Role.fromRoleName(this, "Publisher", props.publisherRoleName);
    bucket.grantRead(publisher);
    bucket.grantPut(publisher);
    publisher.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
      resources: [this.formatArn({ service: "cloudfront", region: "", resource: "distribution", resourceName: distribution.distributionId })]
    }));

    new CfnOutput(this, "BucketName", { value: bucket.bucketName });
    new CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new CfnOutput(this, "SiteUrl", { value: `https://${siteDomain}/` });
  }
}
