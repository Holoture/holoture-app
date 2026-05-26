const BASE = 'https://finnhub.io/api/v1'

export async function finnhubGet<T = unknown>(path: string, revalidate = 300): Promise<T | null> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  const sep = path.includes('?') ? '&' : '?'
  try {
    const res = await fetch(`${BASE}${path}${sep}token=${key}`, {
      next: { revalidate },
    })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}
