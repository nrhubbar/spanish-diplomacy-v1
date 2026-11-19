import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { config } from "./config.ts";

/**
 * The role GitHub Actions assumes to deploy. Only workflow runs on the deploy branch of this
 * repository can assume it. It can deploy CDK stacks only through the CDK bootstrap roles; the
 * site stack grants it the narrow S3 and CloudFront permissions that publishing needs.
 */
export class GithubDeployStack extends Stack {
  readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, "GithubOidc", config.github.oidcProviderArn);
    const { repository, deployBranch, deployRoleName } = config.github;

    this.deployRole = new iam.Role(this, "DeployRole", {
      roleName: deployRoleName,
      description: `GitHub Actions deploys from ${repository} on ${deployBranch}`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": `repo:${repository}:ref:refs/heads/${deployBranch}`
        }
      })
    });

    const { account, region } = config.env;
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: "AssumeCdkBootstrapRoles",
      actions: ["sts:AssumeRole", "sts:TagSession"],
      resources: [`arn:aws:iam::${account}:role/cdk-${config.cdkQualifier}-*-role-${account}-${region}`]
    }));
  }
}
