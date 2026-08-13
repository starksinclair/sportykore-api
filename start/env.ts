/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  TZ: Env.schema.string.optional(),
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),
  SECRET_SANTA_PASSWORD: Env.schema.string.optional(),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring ally package
  |----------------------------------------------------------
  */
  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),

  /**
   * Optional deep link (e.g. Sportykore://auth/callback) used after Google OAuth
   * to return the API token to the mobile app. If unset, JSON is returned instead.
   */
  MOBILE_OAUTH_DEEP_LINK: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the drive package
  |----------------------------------------------------------
  */
  DRIVE_DISK: Env.schema.enum(['fs', 's3', 'gcs'] as const),
  AWS_ACCESS_KEY_ID: Env.schema.string.optional(),
  AWS_SECRET_ACCESS_KEY: Env.schema.string.optional(),
  AWS_REGION: Env.schema.string.optional(),
  S3_BUCKET: Env.schema.string.optional(),
  GCS_BUCKET: Env.schema.string.optional(),
  /**
   * Path to a GCS service account JSON key (e.g. file://gcs_key.json).
   * Omit on GCP when using Application Default Credentials (Cloud Run, GKE).
   */
  GCS_KEY: Env.schema.string.optional(),
  GOOGLE_APPLICATION_CREDENTIALS: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Google Sheets-backed support content
  |----------------------------------------------------------
  */
  SUPPORT_SHEETS_SPREADSHEET_ID: Env.schema.string.optional(),
  SUPPORT_FAQ_SHEET_NAME: Env.schema.string.optional(),
  SUPPORT_BUGS_SHEET_NAME: Env.schema.string.optional(),
  GOOGLE_SHEETS_SPREADSHEET_ID: Env.schema.string.optional(),
  GOOGLE_SHEETS_FAQ_NAME: Env.schema.string.optional(),
  GOOGLE_SHEETS_BUGS_NAME: Env.schema.string.optional(),
  SUPPORT_GOOGLE_CLIENT_EMAIL: Env.schema.string.optional(),
  SUPPORT_GOOGLE_PRIVATE_KEY: Env.schema.string.optional(),
  SUPPORT_GOOGLE_SERVICE_ACCOUNT_KEY: Env.schema.string.optional(),
  GOOGLE_CLIENT_EMAIL: Env.schema.string.optional(),
  GOOGLE_PRIVATE_KEY: Env.schema.string.optional(),
  GOOGLE_SERVICE_ACCOUNT: Env.schema.string.optional(),
  SUPPORT_SEED_TOKEN: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the database
  |----------------------------------------------------------
  */
  DB_CONNECTION: Env.schema.enum(['sqlite', 'pg'] as const),
  DB_HOST: Env.schema.string.optional(),
  DB_PORT: Env.schema.number.optional(),
  DB_USER: Env.schema.string.optional(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string.optional(),
  DB_SSL: Env.schema.boolean.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  MAIL_FROM_ADDRESS: Env.schema.string(),
  MAIL_FROM_NAME: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Mobile app base URL for deep links (e.g. invite links in emails)
  |----------------------------------------------------------
  */
  MOBILE_APP_URL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Expo Push Notifications
  |----------------------------------------------------------
  */
  EXPO_PUSH_ACCESS_TOKEN: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  MAIL_MAILER: Env.schema.enum(['resend', 'ses'] as const),
  RESEND_API_KEY: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the limiter package
  |----------------------------------------------------------
  */
  LIMITER_STORE: Env.schema.enum(['redis', 'memory'] as const),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),
  REDIS_TLS: Env.schema.boolean.optional(),

  /*
  |----------------------------------------------------------
  | App Store / Play Store reviewer OTP bypass (optional)
  |----------------------------------------------------------
  */
  REVIEW_ACCOUNT_ENABLED: Env.schema.boolean.optional(),
  REVIEW_ADMIN_EMAIL: Env.schema.string.optional(),
  REVIEW_PLAYER_EMAIL: Env.schema.string.optional(),
  REVIEW_OTP_CODE: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | DemoSeeder gate — required when NODE_ENV=production
  |----------------------------------------------------------
  */
  ALLOW_DEMO_SEED: Env.schema.boolean.optional(),
})
