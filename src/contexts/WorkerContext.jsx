import { createContext, useContext, useState } from 'react'

const WorkerContext = createContext(null)

export function WorkerProvider({ children }) {
  const [activeWorker, setActiveWorker] = useState(() => {
    try {
      const s = sessionStorage.getItem('activeWorker')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })

  function selectWorker(worker) {
    setActiveWorker(worker)
    if (worker) sessionStorage.setItem('activeWorker', JSON.stringify(worker))
    else sessionStorage.removeItem('activeWorker')
  }

  return (
    <WorkerContext.Provider value={{ activeWorker, selectWorker }}>
      {children}
    </WorkerContext.Provider>
  )
}

export function useWorker() {
  const ctx = useContext(WorkerContext)
  if (!ctx) throw new Error('useWorker must be inside WorkerProvider')
  return ctx
}
