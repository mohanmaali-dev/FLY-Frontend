import { FiExternalLink, FiGithub, FiShield } from 'react-icons/fi'

import InfoPage, { InfoSection } from '../components/InfoPage.jsx'

const REPOSITORY = 'https://github.com/mohanmaali-dev/FLY-Frontend'

function ContactPage() {
  return (
    <InfoPage
      eyebrow="Support"
      title="How can we help?"
      intro="For product questions, unexpected behaviour or suggestions, use the FLY project support channels below."
    >
      <InfoSection title="Product support">
        <p>Open a GitHub issue with the device, browser and steps that caused the problem. Do not include pairing links, passwords, access keys or shared content.</p>
        <a
          href={`${REPOSITORY}/issues/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-strong px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition hover:bg-accent-hover"
        >
          <FiGithub size={16} /> Open a support issue <FiExternalLink size={13} />
        </a>
      </InfoSection>

      <InfoSection title="Security reports">
        <p>If you discover a security issue, report it privately through GitHub&apos;s security advisory flow rather than posting the details publicly.</p>
        <a
          href={`${REPOSITORY}/security/advisories/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-accent-line hover:text-accent-hover"
        >
          <FiShield size={16} /> Report privately <FiExternalLink size={13} />
        </a>
      </InfoSection>
    </InfoPage>
  )
}

export default ContactPage
