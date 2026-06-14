import { readFileSync } from 'node:fs'

import env from '#start/env'
import { defineConfig, services } from '@adonisjs/drive'
import type { InferDriveDisks } from '@adonisjs/drive/types'
import '@adonisjs/drive/drive_provider'
import app from '@adonisjs/core/services/app'

/**
 * GCS auth per Adonis Drive docs: GCS_KEY=file://gcs_key.json (relative to app root).
 * Omit GCS_KEY on Cloud Run / GKE to use Application Default Credentials.
 */
function gcsAuthOptions() {
  const gcsKey = env.get('GCS_KEY')
  if (!gcsKey) {
    return {}
  }

  const keyPath = gcsKey.startsWith('file://')
    ? app.makePath(gcsKey.replace(/^file:\/\//, ''))
    : gcsKey

  return {
    credentials: JSON.parse(readFileSync(keyPath, 'utf-8')),
  }
}

const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK'),

  /**
   * The services object can be used to configure multiple file system
   * services each using the same or a different driver.
   */
  services: {
    fs: services.fs({
      location: app.makePath('storage'),
      visibility: 'public',
      serveFiles: true,
      routeBasePath: '/uploads',
      appUrl: env.get('APP_URL'),
    }),
    s3: services.s3({
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY', ''),
      },
      region: env.get('AWS_REGION', 'us-east-1'),
      bucket: env.get('S3_BUCKET', ''),
      visibility: 'public',
    }),
    gcs: services.gcs({
      ...gcsAuthOptions(),
      bucket: env.get('GCS_BUCKET', ''),
      visibility: 'public',
    }),
  },
})

export default driveConfig

export type DriveDisk = keyof InferDriveDisks<typeof driveConfig>

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
