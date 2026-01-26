# Social Proof Popup - Test Cases

## 1. App Install/Uninstall

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1.1 | Fresh Install | 1. Go to Shopify App Store 2. Click "Add app" 3. Authorize permissions | App installs successfully, redirects to app dashboard | ✅ PASS |
| 1.2 | Permission Scopes | Check app permissions during install | Requests: read_orders, read_products, read_themes | ✅ PASS |
| 1.3 | OAuth Flow | Complete OAuth authorization | Access token stored, session created | ✅ PASS |
| 1.4 | App Uninstall | Settings → Apps → Delete socialproof | App removed, data cleaned up | ✅ PASS |
| 1.5 | Reinstall After Uninstall | Uninstall then reinstall app | Fresh install works, new session created | ✅ PASS |

---

## 2. Configuration / Settings

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.1 | Default Settings Load | Open app settings page | Default values loaded (popup enabled, demo mode on, bottom-left position) | ✅ PASS |
| 2.2 | Toggle Popup Enabled | Turn off "Show Popups" toggle | Popups stop appearing on storefront | ✅ PASS |
| 2.3 | Toggle Demo Mode ON | Enable demo mode | Demo popups appear with sample data | ✅ PASS |
| 2.4 | Toggle Demo Mode OFF | Disable demo mode | Only real orders show (or no popups if no orders) | ✅ PASS |
| 2.5 | Change Position - Bottom Left | Select BOTTOM_LEFT | Popup appears in bottom-left corner | ✅ PASS |
| 2.6 | Change Position - Bottom Right | Select BOTTOM_RIGHT | Popup appears in bottom-right corner | ✅ PASS |
| 2.7 | Change Position - Top Left | Select TOP_LEFT | Popup appears in top-left corner | ✅ PASS |
| 2.8 | Change Position - Top Right | Select TOP_RIGHT | Popup appears in top-right corner | ✅ PASS |
| 2.9 | Popup Delay Setting | Set delay to 10 seconds | First popup appears after 10 seconds | ✅ PASS |
| 2.10 | Display Duration Setting | Set duration to 6 seconds | Popup stays visible for 6 seconds | ✅ PASS |
| 2.11 | Save Settings | Click Save button | Settings persist after page refresh | ✅ PASS |
| 2.12 | Settings Sync to Metafields | Save settings | Metafields updated for theme extension | ✅ PASS |

---

## 3. Billing API

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.1 | Billing Page Load | Navigate to /app/billing | Billing page displays with plan details | ✅ PASS |
| 3.2 | Show Plan Details | View billing page | Shows $9.99/month, 7-day trial, features list | ✅ PASS |
| 3.3 | Start Free Trial | Click "Start 7-Day Free Trial" | Redirects to Shopify billing approval page | ✅ PASS |
| 3.4 | Approve Subscription | Approve charge in Shopify | Subscription activated, status shows "Active" | ✅ PASS |
| 3.5 | Decline Subscription | Decline charge in Shopify | Returns to app, subscription inactive | ✅ PASS |
| 3.6 | Test Mode Billing | Verify isTest: true | No real charges, test subscription created | ✅ PASS |
| 3.7 | Check Subscription Status | View billing page after subscribe | Shows "Active" badge, plan name displayed | ✅ PASS |
| 3.8 | Trial Days Display | During trial period | Shows remaining trial days | ✅ PASS |

---

## 4. Premium Features

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 4.1 | Free User - Demo Data Only | Without subscription | Only demo data available, real orders hidden | ✅ PASS |
| 4.2 | Pro User - Real Orders | With active subscription | Real order data synced and displayed | ✅ PASS |
| 4.3 | Pro User - Custom Activities | With subscription | Can customize popup content | ✅ PASS |
| 4.4 | Feature Gate - Settings | Free vs Pro settings | Pro users see additional settings options | ✅ PASS |
| 4.5 | Subscription Check on Save | Save settings as Pro | isPro flag saved to metafields | ✅ PASS |
| 4.6 | Downgrade Handling | Cancel subscription | Falls back to demo mode | ✅ PASS |

---

## 5. Demo Customization

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.1 | Demo Popup Display | Enable demo mode, visit store | Demo popups show with sample products | ✅ PASS |
| 5.2 | Demo Products Cycle | Watch multiple popups | 5 different demo products rotate | ✅ PASS |
| 5.3 | Demo Cities Display | View demo popups | Shows cities: New York, Los Angeles, Chicago, Houston, Miami | ✅ PASS |
| 5.4 | Demo Time Ago | Check popup text | Shows "X minutes ago" format | ✅ PASS |
| 5.5 | Demo Images Load | View popup images | Placeholder product images load correctly | ✅ PASS |
| 5.6 | Demo Counter Badge | Visit product page | Counter shows random number (5-50) | ✅ PASS |
| 5.7 | Popup Animation - Enter | Popup appears | Smooth slide-in animation | ✅ PASS |
| 5.8 | Popup Animation - Exit | Popup closes | Smooth fade-out animation | ✅ PASS |
| 5.9 | Close Button | Click X on popup | Popup closes, dismiss count incremented | ✅ PASS |
| 5.10 | Dismiss Threshold | Close popup 3 times | Popups stop showing (localStorage tracked) | ✅ PASS |

---

## 6. Real-Time Orders Sync

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 6.1 | Manual Sync Page | Navigate to /app/syncorders | Sync Orders page loads | ✅ PASS |
| 6.2 | Sync Orders Button | Click "Sync Orders Now" | Orders fetched from Shopify API | ✅ PASS |
| 6.3 | Orders Count Display | After sync | Shows correct number of tracked orders | ✅ PASS |
| 6.4 | Orders Table Display | After sync with orders | Table shows Product, City, Country, Date | ✅ PASS |
| 6.5 | Duplicate Prevention | Sync same orders twice | No duplicate entries created | ✅ PASS |
| 6.6 | Product Title Capture | Sync order with products | Product titles saved correctly | ✅ PASS |
| 6.7 | Product Image Capture | Sync order with images | Product images URL saved | ✅ PASS |
| 6.8 | Placeholder Image | Product without image | Uses placeholder image URL | ✅ PASS |
| 6.9 | Real Orders in Popup | Demo mode OFF, orders synced | Real orders appear in storefront popups | ⏳ PENDING* |
| 6.10 | Webhook Registration | Protected Data approved | orders/create webhook active | ⏳ PENDING* |

*Requires Protected Customer Data approval for full functionality

---

## 7. Storefront Widget

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.1 | Widget Loads | Visit storefront | social-proof.js loads without errors | ✅ PASS |
| 7.2 | CSS Loads | Visit storefront | social-proof.css applied correctly | ✅ PASS |
| 7.3 | Config from Metafields | Check page source | Settings embedded in JSON script tag | ✅ PASS |
| 7.4 | Show on Homepage | Visit homepage | Popups appear (if enabled for home) | ✅ PASS |
| 7.5 | Show on Product Page | Visit product page | Popups appear (if enabled for product) | ✅ PASS |
| 7.6 | Show on Collection Page | Visit collection page | Popups appear (if enabled for collection) | ✅ PASS |
| 7.7 | Show on Cart Page | Visit cart page | Popups appear (if enabled for cart) | ✅ PASS |
| 7.8 | Page Type Filtering | Disable home page | No popups on homepage, shows on others | ✅ PASS |
| 7.9 | Counter on Product Page | Visit product page | Purchase counter visible near Add to Cart | ✅ PASS |
| 7.10 | Counter Animation | Counter becomes visible | Number animates from 0 to value | ✅ PASS |

---

## Test Summary

| Category | Total | Passed | Failed | Pending |
|----------|-------|--------|--------|---------|
| Install/Uninstall | 5 | 5 | 0 | 0 |
| Configuration | 12 | 12 | 0 | 0 |
| Billing API | 8 | 8 | 0 | 0 |
| Premium Features | 6 | 6 | 0 | 0 |
| Demo Customization | 10 | 10 | 0 | 0 |
| Real-Time Sync | 10 | 8 | 0 | 2 |
| Storefront Widget | 10 | 10 | 0 | 0 |
| **TOTAL** | **61** | **59** | **0** | **2** |

---

## Notes

1. **Protected Customer Data**: Real-time webhook sync requires Shopify approval for protected customer data access. Manual sync works as workaround.

2. **Test Environment**: All tests performed on development store (socialproof-2.myshopify.com)

3. **Billing Tests**: Performed with `isTest: true` - no real charges

4. **Browser Tested**: Chrome (latest)

---

*Last Updated: January 26, 2026*
