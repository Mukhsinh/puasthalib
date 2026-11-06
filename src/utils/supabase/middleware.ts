import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    // ONLY perform Supabase Auth API call if user is accessing protected /admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const allCookies = request.cookies.getAll()
        const hasAuthCookie = allCookies.some(c =>
            c.name.includes('auth-token') ||
            c.name.startsWith('sb-') ||
            c.name.includes('supabase')
        )

        // If no auth cookie exists at all, redirect to /login
        if (!hasAuthCookie) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        try {
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        getAll() {
                            return request.cookies.getAll()
                        },
                        setAll(cookiesToSet) {
                            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                            supabaseResponse = NextResponse.next({
                                request,
                            })
                            cookiesToSet.forEach(({ name, value, options }) =>
                                supabaseResponse.cookies.set(name, value, {
                                    ...options,
                                    path: '/',
                                    sameSite: 'lax',
                                })
                            )
                        },
                    },
                }
            )

            // Refresh session if expired - this will update response cookies via setAll
            const { data: { user }, error: userError } = await supabase.auth.getUser()

            if (!user) {
                // Check if session fallback exists
                const { data: { session } } = await supabase.auth.getSession()

                // Only redirect if absolutely no user AND no session exists
                // AND there's a definite auth error rather than network glitch
                if (!session && userError?.message?.includes('Invalid')) {
                    const url = request.nextUrl.clone()
                    url.pathname = '/login'
                    return NextResponse.redirect(url)
                }
            }
        } catch (error) {
            console.error("Middleware auth verification notice:", error)
            // Do not aggressively kick user on transient backend error
        }
    }

    return supabaseResponse
}
