declare module 'qrcode/lib/browser.js' {
  interface QrCodeOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    margin?: number
    type: 'svg'
    width?: number
  }

  const QRCode: {
    toString(text: string, options: QrCodeOptions): Promise<string>
  }

  export default QRCode
}
