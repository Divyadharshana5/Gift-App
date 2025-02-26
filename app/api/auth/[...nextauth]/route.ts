import NextAuth, { AuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectToDatabase } from "@/global/lib/mongodb";
import User, { IUser, UserLoginSchema } from "@/global/models/User";
import { validateData } from "@/global/lib/validate";
import { JWT } from "next-auth/jwt";

type CustomSession = Session & {
  user: {
    id: string;
  };
};

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Validate credentials with Zod
        const validation = await validateData(UserLoginSchema, {
          email: credentials.email,
          password: credentials.password,
        });

        if (!validation.success) {
          throw new Error("Invalid credentials");
        }

        await connectToDatabase();

        // Find user and include password for comparison
        const user = await User.findOne({ email: credentials.email }).select(
          "+password"
        );

        if (!user) {
          throw new Error("User not found");
        }

        const isPasswordMatch = await user.comparePassword(
          credentials.password
        );

        if (!isPasswordMatch) {
          throw new Error("Invalid password");
        }

        // Return user without password
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user: IUser }) {
      if (user) {
        token.id = user.id as string;
      }
      return token;
    },
    async session({ session, token }: { session: CustomSession; token: JWT }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions as unknown as AuthOptions);

export { handler as GET, handler as POST };
