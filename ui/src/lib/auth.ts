import type { NextAuthOptions, Profile, TokenSet } from 'next-auth'
import ZohoProvider from 'next-auth/providers/zoho'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    /**
     * @todo - Remove token and userinfo once cloudflare support request.https on the server side.
     * pull-request https://github.com/cloudflare/workers-sdk/pull/10150
     */
    ZohoProvider({
      clientId: process.env.ZOHO_CLIENT_ID!,
      clientSecret: process.env.ZOHO_CLIENT_SECRET!,
      token: {
        url: 'https://accounts.zoho.com/oauth/v2/token',
        request: async (context) => {
          const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: context.provider.clientId!,
              client_secret: context.provider.clientSecret!,
              grant_type: 'authorization_code',
              code: context.params.code!,
              redirect_uri: context.provider.callbackUrl!,
            }),
          })

          return { tokens: (await res.json()) as TokenSet }
        },
      },
      userinfo: {
        url: 'https://accounts.zoho.com/oauth/user/info',
        request: async ({tokens}) => {
          const res = await fetch('https://accounts.zoho.com/oauth/user/info', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          })

          if (!res.ok) {
            throw new Error(
              `Failed to fetch user info from Zoho: ${res.statusText}`,
            )
          }

          return res.json() as Profile
        },
      },
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
