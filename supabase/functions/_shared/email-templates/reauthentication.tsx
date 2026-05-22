/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface Props { token: string }
const BRAND = 'SatahInvoice'
const SITE_URL = 'https://satahinvoice.com'

export const ReauthenticationEmail = ({ token }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {BRAND} verification code: {token}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={logo}>{BRAND}</Text><Text style={tagline}>Invoicing made simple</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Verification code 🔢</Heading>
          <Text style={text}>Use the code below to confirm your identity. This code expires shortly.</Text>
          <Section style={codeBox}><Text style={codeStyle}>{token}</Text></Section>
          <Hr style={hr} />
          <Text style={footer}>If you didn't request this code, you can safely ignore this email.</Text>
        </Section>
        <Text style={brandFooter}>© {new Date().getFullYear()} {BRAND} · <Link href={SITE_URL} style={brandLink}>satahinvoice.com</Link></Text>
      </Container>
    </Body>
  </Html>
)
export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 20px' }
const header = { textAlign: 'center' as const, padding: '8px 0 24px' }
const logo = { fontSize: '26px', fontWeight: 700 as const, color: '#1d4ed8', margin: '0', letterSpacing: '-0.5px' }
const tagline = { fontSize: '12px', color: '#64748b', margin: '4px 0 0', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }
const card = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '32px 28px' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const codeBox = { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '20px', textAlign: 'center' as const, margin: '24px 0' }
const codeStyle = { fontFamily: "'SF Mono', Menlo, Courier, monospace", fontSize: '32px', fontWeight: 700 as const, color: '#1d4ed8', letterSpacing: '8px', margin: '0' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 20px' }
const footer = { fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: '0' }
const brandFooter = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const, margin: '24px 0 0' }
const brandLink = { color: '#64748b', textDecoration: 'none' }
