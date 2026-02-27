Publishing MarkdownViewer to Microsoft Store - Instructions

Prerequisites:
- Microsoft Partner Center developer account (active)
- App name reserved in Partner Center
- Code-signing certificate (PFX) with associated publisher ID (CN=...)
- App icons and store screenshots (PNG), privacy policy URL or file

Steps:
1. Reserve your app name in Partner Center and create a new app submission.
2. Prepare a signed MSIX package (recommended for Store). Configure electron-builder for MSIX signing:
   - Add your PFX and password to electron-builder config or provide them via environment variables (CSC_LINK / CSC_KEY_PASSWORD) when building.
   - Ensure "publisher" in package.json build config matches the PFX subject.
   - Command example (PowerShell): $env:CSC_LINK='file://C:\path\to\cert.pfx'; $env:CSC_KEY_PASSWORD='pfxPassword'; npx electron-builder --win msix
3. If you cannot sign yet, you can submit MSIX through Partner Center using a package signed by Microsoft (associate app with Store) — consult Partner Center docs.
4. Create store listing content: short description, full description, keywords, support URL, privacy policy.
   - Replace the placeholder files in store/ (listing.md, privacy-policy.md, metadata.json) with final content.
5. Prepare store assets: PNG screenshots (landscape and portrait as required), icons in required sizes. Upload these in the Partner Center submission.
6. Upload the signed MSIX (or Appx) package in the submission and complete the metadata forms.
7. Submit and wait for certification.

Notes & troubleshooting:
- Electron-builder MSIX target often requires Visual Studio/Windows SDK for MSIX tooling. If electron-builder cannot produce MSIX locally, use the Partner Center to convert Appx/MSIX or use manual packaging tools.
- For automated builds, consider CI with secure storage for your PFX certificate and passwords.

If you want, I can:
- Attempt to build a signed MSIX if you provide a PFX and password.
- Walk through each Partner Center submission step interactively.
