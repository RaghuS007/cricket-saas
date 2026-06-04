// Shape of the decoded Supabase JWT payload
export interface SupabaseJwtPayload {
  sub: string;      // Supabase user UUID — used as UserProfile.id
  email: string;
  role: string;     // 'authenticated'
  aud: string;
  exp: number;
  iat: number;
}

// Normalised user object attached to req.user by JwtStrategy.validate()
export interface AuthUser {
  id: string;
  email: string;
}
