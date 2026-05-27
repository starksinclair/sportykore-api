import vine from '@vinejs/vine'

/** Primary / foreign key: positive integer (matches unsigned DB columns). */
export const resourceId = (tableName: string, columnName: string = 'id') =>
  vine.number().exists({ table: tableName, column: columnName }).positive()

/** Optional FK (omit or pass a positive integer). */
export const optionalResourceId = (tableName: string) => resourceId(tableName).optional()

/** Optional absolute URL (e.g. logo, avatar). */
export const optionalHttpUrl = () =>
  vine.string().url({ require_tld: false }).maxLength(2048).optional()

/** Optional URL or explicit null to clear. */
export const optionalHttpUrlNullable = () => optionalHttpUrl().nullable().optional()

export const optionalImage = () =>
  vine
    .file({
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP'],
    })
    .optional()
