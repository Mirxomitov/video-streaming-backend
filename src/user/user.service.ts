import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { User, UserDocument } from './user.schema'

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly user_model: Model<UserDocument>,
  ) {}

  async find_by_phone(phone: string) {
    return this.user_model.findOne({ phone })
  }

  async find_or_create(phone: string) {
    const user = await this.find_by_phone(phone)

    if (user) {
      return user
    }

    return this.user_model.create({ phone })
  }
}
