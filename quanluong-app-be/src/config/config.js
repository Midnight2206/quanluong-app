import { env } from "./env.js";

const config = {
  app: {
    name: env.appName,
    env: env.nodeEnv,
    port: env.port,
    isProduction: env.nodeEnv === "production",
  },
  socket: {
    port: env.socketPort,
    /** Socket.io trên `http.Server` riêng, không đi chung cổng REST. */
    useDedicatedServer: env.socketPort > 0 && env.socketPort !== env.port,
  },
  db: {
    url: env.databaseUrl,
  },
  redis: {
    url: env.redisUrl,
  },
  publicWebUrl: env.publicWebUrl,
  auth: {
    jwtAccessSecret: env.jwtAccessSecret,
    sessionSecret: env.sessionSecret,
    sessionCookieName: env.sessionCookieName,
    accessTokenCookieName: env.accessTokenCookieName,
    refreshTokenCookieName: env.refreshTokenCookieName,
    accessTokenExpiresIn: env.accessTokenExpiresIn,
    refreshTokenExpiresDays: env.refreshTokenExpiresDays,
    /** @type {string | undefined} */
    cookieDomain: env.cookieDomain,
    permissionSyncOnBoot: env.permissionSyncOnBoot,
    runSuperadminBootstrap: env.runSuperadminBootstrap,
    superadminEmail: env.superadminEmail,
    superadminUsername: env.superadminUsername,
    superadminPassword: env.superadminPassword,
    superadminFullName: env.superadminFullName,
    registrationRequiresApproval: env.registrationRequiresApproval,
    minUnitDepthToApproveRegistration: env.minUnitDepthToApproveRegistration,
    requireEmailVerification: env.requireEmailVerification,
  },
  google: {
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: env.googleRedirectUri,
    loginRedirectUri: env.googleLoginRedirectUri,
    chungTuSystemDriveRefreshToken: env.chungTuSystemDriveRefreshToken,
    chungTuSystemTemplateFolderId: env.chungTuSystemTemplateFolderId,
  },
  security: {
    corsOrigins: env.corsOrigins,
    /** Tối đa request / IP / 15 phút cho lớp rate-limit chung `app.js` (trừ đã skip). */
    globalApiRateLimitMax: env.globalApiRateLimitMax,
  },
  media: {
    root: env.mediaRoot,
    publicPath: env.mediaPublicPath,
  },
  mail: {
    transport: env.mailTransport,
    gmailSenderRefreshToken: env.gmailSenderRefreshToken,
    gmailSenderEmail: env.gmailSenderEmail,
    ...env.smtp,
  },
};

export { config };
