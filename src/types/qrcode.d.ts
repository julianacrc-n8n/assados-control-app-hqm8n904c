/**
 * Minimal ambient type declaration for the `qrcode` package so `import QRCode
 * from 'qrcode'` type-checks without `@types/qrcode`. We only use
 * `QRCode.toDataURL(text, options?)`, which returns a Promise<string>.
 */
declare module 'qrcode' {
  export interface ToDataURLOptions {
    width?: number
    margin?: number
    color?: {
      dark?: string
      light?: string
    }
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    [key: string]: unknown
  }
  const QRCode: {
    toDataURL(text: string, options?: ToDataURLOptions): Promise<string>
    toDataURL(
      text: string,
      options: ToDataURLOptions,
      cb: (err: Error | null | undefined, url: string) => void,
    ): void
    toDataURL(text: string, cb: (err: Error | null | undefined, url: string) => void): void
  }
  export default QRCode
}
