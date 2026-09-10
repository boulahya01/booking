<script lang="ts">
  import PublicPage from '$lib/components/PublicPage.svelte'
</script>

<svelte:head>
  <title>Privacy Policy — UNEM Sports</title>
  <meta
    name="description"
    content="How UNEM Sports collects, uses, protects and deletes account, Google sign-in, student verification and sports activity data."
  />
  <link rel="canonical" href="https://uneem.site/privacy" />
</svelte:head>

<PublicPage>
  <article class="public-copy">
    <p class="eyebrow">Legal</p>
    <h1>Privacy Policy</h1>
    <p class="lede">
      This policy explains what information UNEM Sports processes, why we use it, and the choices
      available to you when you use the service.
    </p>
    <p class="updated">Last updated: September 10, 2026</p>

    <div class="legal-body">
      <section>
        <h2>About UNEM Sports</h2>
        <p>
          UNEM Sports is a student sports platform available at uneem.site. It helps students find
          sports facilities, view available time slots, create and manage bookings, and create or
          join open matches.
        </p>
        <p>
          For privacy questions or data requests, use the
          <a class="inline-link" href="/help">UNEM Sports Support</a> page.
        </p>
      </section>

      <section>
        <h2>Information we process</h2>
        <ul>
          <li>Account information such as your name, email address, username and authentication identifiers.</li>
          <li>Student verification information such as your Student ID, verification status and student-card proof you submit for review.</li>
          <li>Sports activity such as bookings, match participation, invitations and related facility activity.</li>
          <li>Support information you choose to send when contacting support.</li>
          <li>Basic technical and security information processed by our hosting and authentication providers to operate and protect the service.</li>
        </ul>
      </section>

      <section>
        <h2>Google Sign-In</h2>
        <p>
          If you choose Sign in with Google, UNEM Sports requests only the standard OpenID Connect
          scopes <strong>openid</strong>, <strong>email</strong> and <strong>profile</strong>. Google may provide us with your
          Google account identifier, email address, name and profile information such as a profile
          image when available.
        </p>
        <p>
          We use this Google information only to authenticate you, create or identify your UNEM
          Sports account, and provide account functionality. We do not request access to Gmail,
          Google Drive, Google Contacts, Google Calendar or other Google services.
        </p>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>Authenticate your account and keep sign-in sessions secure.</li>
          <li>Verify that one Student ID belongs to one student identity before protected sports actions are unlocked.</li>
          <li>Provide facility availability, booking, match and invitation features.</li>
          <li>Send transactional account messages such as confirmation, recovery and security notifications.</li>
          <li>Respond to support requests and investigate abuse, security or account-recovery issues.</li>
          <li>Maintain the integrity, reliability and performance of the service.</li>
        </ul>
      </section>

      <section>
        <h2>Student verification</h2>
        <p>
          Authentication by email or Google does not by itself grant verified-student rights.
          Protected sports actions require an approved Student ID verification. Student-card files
          are stored privately and are available only through restricted application or administrator
          access needed for verification and recovery review.
        </p>
      </section>

      <section>
        <h2>Service providers and sharing</h2>
        <p>
          We use service providers to run UNEM Sports, including Supabase for authentication,
          database and private file storage; Vercel for application hosting; Resend for transactional
          email delivery; and Google when you choose Google Sign-In. These providers process data
          only as needed to deliver their services to us and are subject to their own privacy and
          security terms.
        </p>
        <p>
          UNEM Sports does not sell personal information or Google user data. We do not share your
          information for third-party advertising.
        </p>
      </section>

      <section>
        <h2>Data retention</h2>
        <p>
          We retain account and activity data while it is needed to provide the service, preserve
          booking and security integrity, resolve disputes, or prevent abuse. Verification material
          is retained only for as long as reasonably needed for verification, recovery, security and
          audit purposes. Where full deletion would undermine fraud-prevention or system-integrity
          records, data may instead be minimized or de-identified where appropriate.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We use access controls, Row Level Security, private storage for verification files, secured
          authentication flows and server-side authorization for protected actions. No online system
          can guarantee absolute security, but we design the service to limit unnecessary access and
          exposure.
        </p>
      </section>

      <section>
        <h2>Your choices and deletion</h2>
        <p>
          You may request correction or deletion of personal information associated with your UNEM
          Sports account. Instructions are available on our
          <a class="inline-link" href="/data-deletion">Data deletion</a> page. Removing Google access
          from your Google Account stops that sign-in connection but does not automatically delete
          data already stored in UNEM Sports; use the deletion process if you also want your UNEM
          Sports data removed.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          We may update this policy when the product, legal requirements or data practices change.
          The latest version will remain available at this URL with an updated date.
        </p>
      </section>
    </div>
  </article>
</PublicPage>
