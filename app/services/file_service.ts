import type { MultipartFile } from '@adonisjs/core/bodyparser'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import type { DriveDisk } from '#config/drive'

export default class FileService {
  defaultDisk(): DriveDisk {
    return env.get('DRIVE_DISK')
  }

  async upload(file: MultipartFile, key: string, disk?: DriveDisk) {
    const target = disk ?? this.defaultDisk()
    await file.moveToDisk(key, target)
    return await drive.use(target).getUrl(key)
  }
}
