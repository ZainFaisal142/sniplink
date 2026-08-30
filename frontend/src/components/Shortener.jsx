// Inside src/components/Shortener.jsx

const handleShorten = async (e) => {
  e.preventDefault()
  setErrorMsg('')
  if (!longUrl) return

  try {
    // 1. Point to your live Cloudflare Worker backend
    const workerBaseUrl = 'https://sniplink.zainfaisal107.workers.dev'

    const response = await fetch(`${workerBaseUrl}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longUrl })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to shorten.')
    }

    // 2. Set the short link pointing directly to your live Worker!
    // This ensures clicking the link hits Cloudflare instead of Vercel.
    setShortLink(`${workerBaseUrl}/${data.shortCode}`)
  } catch (err) {
    setErrorMsg(err.message)
  }
}