const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')
const fs   = require('fs')

function resolveIcon () {
  const candidates = [
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(__dirname, 'assets', 'icon.png')
  ]
  return candidates.find(p => fs.existsSync(p)) || undefined
}

function createWindow() {
  Menu.setApplicationMenu(null)   // remove native menu bar

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: resolveIcon(),
    title: 'Holy Bible — መጽሐፍ ቅዱስ | Macaafa Qulquulu',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false
    }
  })

  win.loadFile('src/index.html')
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
