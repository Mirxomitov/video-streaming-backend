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

  async find_by_id(id: string) {
    return this.user_model.findById(id)
  }

  async update_profile(id: string, full_name: string) {
    return this.user_model.findByIdAndUpdate(id, { full_name: full_name.trim() }, { returnDocument: 'after' })
  }

  list_for_moderation() {
    return this.user_model.find().sort({ created_at: -1 }).limit(100)
  }

  set_banned(id: string, is_banned: boolean) {
    return this.user_model.findByIdAndUpdate(id, { is_banned }, { returnDocument: 'after' })
  }
}
