/** Everything account-specific lives here, so a second environment is a second config object. */
export const config = {
  env: { account: "756988898359", region: "us-east-1" },
  /** Existing public hosted zone, shared with the personal website. Referenced, never managed. */
  hostedZone: { zoneName: "nicholas-hubbard.com", hostedZoneId: "Z00688743ABCVAHBVDBW7" },
  subdomain: "spanish-diplomacy",
  github: {
    /** Existing account-wide provider, shared with other repositories. Imported, never managed. */
    oidcProviderArn: "arn:aws:iam::756988898359:oidc-provider/token.actions.githubusercontent.com",
    repository: "nrhubbar/spanish-diplomacy-v1",
    deployBranch: "main",
    deployRoleName: "spanish-diplomacy-github-deploy"
  },
  /** CDK bootstrap qualifier (the default). The deploy role may assume only these roles. */
  cdkQualifier: "hnb659fds"
} as const;

export const siteDomain = `${config.subdomain}.${config.hostedZone.zoneName}`;
