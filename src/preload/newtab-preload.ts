import { contextBridge, ipcRenderer } from 'electron'

const terranoNewTab = {
  getConfig: () => ipcRenderer.invoke('newtab:get-config') as Promise<{ searchEngine: string; theme: string }>,
  getTopSites: () =>
    ipcRenderer.invoke('newtab:get-top-sites') as Promise<
      { url: string; title: string; faviconUrl: string | null; visitCount: number }[]
    >
}

contextBridge.exposeInMainWorld('terranoNewTab', terranoNewTab)
