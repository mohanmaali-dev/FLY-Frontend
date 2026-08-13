import InfoPage, { InfoSection } from '../components/InfoPage.jsx'

function TermsPage() {
  return (
    <InfoPage
      eyebrow="Terms"
      title="Simple terms for using FLY"
      intro="Use FLY responsibly, protect your pairing links and only share content you have the right to share."
    >
      <InfoSection title="Using the service">
        <p>FLY provides browser-based device pairing and content transfer. You are responsible for the content you send or download.</p>
        <p>Do not use FLY to distribute unlawful, harmful or infringing content, attempt unauthorized access, disrupt the service or bypass its security controls.</p>
      </InfoSection>

      <InfoSection title="Pairing and availability">
        <p>Anyone with an active pairing code or link may be able to join that session, so share it only with the intended person or device. Network conditions and third-party infrastructure can affect availability and transfer speed.</p>
      </InfoSection>

      <InfoSection title="Your content">
        <p>You keep ownership of your content. You give the service only the limited permission needed to transmit, store and display it for the features you choose to use.</p>
      </InfoSection>

      <InfoSection title="Changes and support">
        <p>Features may evolve as FLY improves. Material changes to these terms will be reflected on this page with an updated date.</p>
      </InfoSection>
    </InfoPage>
  )
}

export default TermsPage
