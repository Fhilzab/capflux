import { LocalRepository } from '../offline/localDb';

export const ProfileRepository = {
  async saveProfile(profile: Record<string, any>) {
    return LocalRepository.saveProfile(profile);
  },
};
