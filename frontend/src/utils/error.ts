export const formatErrorMessage = (err: any) => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry
        }
        if (entry && typeof entry === 'object') {
          const location = Array.isArray(entry.loc) ? entry.loc.join('.') : entry.loc
          return `${entry.type || 'Error'} at ${location}: ${entry.msg || entry.message || ''}`.trim()
        }
        return JSON.stringify(entry)
      })
      .join('\n')
    }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail)
  }
  return err?.message || 'Unknown error'
}








