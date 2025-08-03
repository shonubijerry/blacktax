// lib/auth.ts
import type { NextAuthOptions } from 'next-auth'
import ZohoProvider from 'next-auth/providers/zoho'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    ZohoProvider({
      clientId: process.env.ZOHO_CLIENT_ID!,
      clientSecret: process.env.ZOHO_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      session.user = {
        email: token.email,
        name: token.name,
        image: token.picture,
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
