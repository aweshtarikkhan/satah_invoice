/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface Props { siteName: string; siteUrl: string; recipient: string; confirmationUrl: string }
const BRAND = 'SatahInvoice'

export const MagicLinkEmail = ({ siteUrl, confirmationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for {BRAND}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={logo}>{BRAND}</Text><Text style={tagline}>Invoicing made simple</Text></Section>
        <Section style={card}>
          <Heading style={h1}>Sign in to {BRAND} ✨</Heading>
          <Text style={text}>Click the button below to securely sign in to your account. This link expires in 1 hour.</Text>
          <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
            <Button style={button} href={confirmationUrl}>Sign in to {BRAND}</Button>
          </Section>
          <Text style={smallText}>Or copy this link:<br /><Link href={confirmationUrl} style={link}>{confirmationUrl}</Link></Text>
          <Hr style={hr} />
          <Text style={footer}>If you didn't request this, ignore this email — no action will be taken.</Text>
        </Section>
        <Text style={brandFooter}>© {new Date().getFullYear()} {BRAND} · <Link href={siteUrl} style={brandLink}>satahinvoice.com</Link></Text>
      </Container>
    </Body>
  </Html>
)
export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 20px' }
const header = { textAlign: 'center' as const, padding: '8px 0 24px' }
const logo = { fontSize: '26px', fontWeight: 700 as const, color: '#1d4ed8', margin: '0', letterSpacing: '-0.5px' }
const tagline = { fontSize: '12px', color: '#64748b', margin: '4px 0 0', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }
const card = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '32px 28px' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const smallText = { fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: '20px 0 0', wordBreak: 'break-all' as const }
const link = { color: '#1d4ed8', textDecoration: 'underline' }
const button = { backgroundColor: '#1d4ed8', color: '#ffffff', fontSize: '15px', fontWeight: 600 as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 20px' }
const footer = { fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: '0' }
const brandFooter = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const, margin: '24px 0 0' }
const brandLink = { color: '#64748b', textDecoration: 'none' }
