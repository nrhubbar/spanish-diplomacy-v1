import { App, Tags } from "aws-cdk-lib";
import { config } from "../lib/config.ts";
import { GithubDeployStack } from "../lib/github-deploy-stack.ts";
import { StaticSiteStack } from "../lib/static-site-stack.ts";

const app = new App();
Tags.of(app).add("project", "spanish-diplomacy");

const github = new GithubDeployStack(app, "SpanishDiplomacyGithubDeploy", {
  env: config.env,
  description: "GitHub Actions OIDC deploy role for Spanish Diplomacy"
});

const site = new StaticSiteStack(app, "SpanishDiplomacySite", {
  env: config.env,
  description: "Spanish Diplomacy static site - S3, CloudFront, ACM, Route 53",
  terminationProtection: true,
  publisherRoleName: config.github.deployRoleName
});
// The site stack attaches its publish policy to the deploy role by name, so the role must exist first.
site.addStackDependency(github);
