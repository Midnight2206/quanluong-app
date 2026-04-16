export const makeUsersService = ({
  usersRepository,
  passwordHasher,
}) => ({
  async create(input) {
    const existingUser = await usersRepository.findByEmail(input.email);

    if (existingUser) {
      const error = new Error("Email already exists.");
      error.code = "EMAIL_EXISTS";
      throw error;
    }

    const passwordHash = await passwordHasher.hash(input.password);

    return usersRepository.create({
      ...input,
      passwordHash,
    });
  },
});
