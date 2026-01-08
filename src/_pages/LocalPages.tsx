import { useEffect, useState } from "react"

interface Page {
  id: number
  name: string
  content: string
  image: string | null
}

const LocalPages: React.FC = () => {
  const [pages, setPages] = useState<Page[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPages()
  }, [])

  const loadPages = async () => {
    try {
      setLoading(true)
      const result = await window.electronAPI.getLocalPages()
      
      if (result.success) {
        setPages(result.pages)
        setError(null)
      } else {
        setError(result.error || "Failed to load pages")
      }
    } catch (err) {
      console.error("Error loading pages:", err)
      setError("Failed to load pages")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const cleanup = window.electronAPI.onNavigatePage((direction: "prev" | "next") => {
      if (direction === "prev") {
        setCurrentPageIndex((prev) => Math.max(0, prev - 1))
      } else {
        setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1))
      }
    })

    return cleanup
  }, [pages.length])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
          <p className="text-white/60 text-sm">Loading pages...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 max-w-md">
          <h2 className="text-red-400 text-lg font-semibold mb-2">Error</h2>
          <p className="text-white/80 text-sm mb-4">{error}</p>
          <p className="text-white/60 text-xs">
            Make sure the "pages" folder exists in your project directory with properly structured page folders.
          </p>
        </div>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-6 max-w-md">
          <h2 className="text-yellow-400 text-lg font-semibold mb-2">No Pages Found</h2>
          <p className="text-white/80 text-sm mb-4">
            No pages found in the "pages" directory.
          </p>
          <p className="text-white/60 text-xs">
            Create folders inside "pages/" with "content.txt" and image files to add pages.
          </p>
        </div>
      </div>
    )
  }

  const currentPage = pages[currentPageIndex]

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with navigation info */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {currentPage.name.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </h1>
            <span className="text-sm text-white/40">
              Page {currentPageIndex + 1} of {pages.length}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
              disabled={currentPageIndex === 0}
              className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 rounded transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + 1))}
              disabled={currentPageIndex === pages.length - 1}
              className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 rounded transition-colors"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Text content */}
          {currentPage.content && (
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <pre className="whitespace-pre-wrap font-mono text-sm text-white/90 leading-relaxed">
                {currentPage.content}
              </pre>
            </div>
          )}

          {/* Image */}
          {currentPage.image && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <img
                src={currentPage.image}
                alt={currentPage.name}
                className="w-full h-auto rounded"
              />
            </div>
          )}
        </div>

        {/* Footer with keyboard shortcuts */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="text-xs text-white/40 space-y-1">
            <p>
              <kbd className="px-2 py-1 bg-white/10 rounded">Alt</kbd> +{" "}
              <kbd className="px-2 py-1 bg-white/10 rounded">Left</kbd> / <kbd className="px-2 py-1 bg-white/10 rounded">Right</kbd>
              {" "}Navigate pages
            </p>
            <p>
              <kbd className="px-2 py-1 bg-white/10 rounded">Alt</kbd> +{" "}
              <kbd className="px-2 py-1 bg-white/10 rounded">B</kbd> Toggle visibility
            </p>
            <p>
              <kbd className="px-2 py-1 bg-white/10 rounded">Ctrl</kbd> +{" "}
              <kbd className="px-2 py-1 bg-white/10 rounded">Arrow</kbd> Move window
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LocalPages
