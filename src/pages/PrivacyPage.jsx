import InfoPage, { InfoSection } from '../components/InfoPage.jsx'

function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Privacy"
      title="Sharing with clarity"
      intro="FLY is designed to move content between your devices with minimal data collection and clear user control."
    >
      <InfoSection title="Device sharing">
        <p>You can pair devices without creating an account. Text and links travel through Supabase Realtime and recent transfer activity is kept in each connected browser.</p>
        <p>Shared files are stored in a private Supabase Storage bucket and opened through time-limited links. Ending a session removes its shared files, while scheduled cleanup handles sessions that were simply closed.</p>
      </InfoSection>

      <InfoSection title="Service monitoring">
        <p>Operational events help identify connection, upload and application errors. Monitoring excludes shared text, links, file names, session identifiers and raw IP addresses.</p>
      </InfoSection>

      <InfoSection title="Your controls">
        <p>You can remove individual transfers, clear visible activity and end a sharing session from the app. Never share passwords, access keys or other secrets through a public support request.</p>
      </InfoSection>
    </InfoPage>
  )
}

export default PrivacyPage
