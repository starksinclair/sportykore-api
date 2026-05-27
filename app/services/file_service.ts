import type { MultipartFile } from '@adonisjs/core/bodyparser'
import drive from '@adonisjs/drive/services/main'

export default class FileService {
  async upload(file: MultipartFile, key: string, disk: 's3' | 'fs' = 's3') {
    await file.moveToDisk(key, disk)
    return drive.use(disk).getUrl(key)
  }
}
