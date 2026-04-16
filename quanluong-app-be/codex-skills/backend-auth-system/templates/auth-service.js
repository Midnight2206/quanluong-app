import jwt from "jsonwebtoken";

export const makeAuthService = ({
  prisma,
  passwordHasher,
  sessionStore,
  jwtSecret,
}) => ({
  async login({ email, password }) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        permissions: true,
      },
    });

    if (!user) {
      const error = new Error("Authentication failed.");
      error.code = "AUTH_FAILED";
      error.status = 401;
      throw error;
    }

    const isValid = await passwordHasher.compare(password, user.passwordHash);

    if (!isValid) {
      const error = new Error("Authentication failed.");
      error.code = "AUTH_FAILED";
      error.status = 401;
      throw error;
    }

    const token = jwt.sign(
      {
        sub: user.id,
        permissions: user.permissions.map((permission) => permission.code),
      },
      jwtSecret,
      { expiresIn: "15m" },
    );

    const session = await sessionStore.create({
      userId: user.id,
    });

    return {
      token,
      sessionId: session.id,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        roles: user.roles.map((role) => role.code),
        permissions: user.permissions.map((permission) => permission.code),
      },
    };
  },
});
