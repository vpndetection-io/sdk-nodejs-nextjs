# Changelog

What each release changed for you, newest first. Each line is a commit's summary, linked to its full description and diff. Releases before 2.0.3 are described by their release commits.

## 2.1.10 - 2026-10-26

### Fixes

- Require vpndetection 5.10.2, which reads dates as RFC 3339 alone ([`d549f45`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/d549f455bbc20adb2a211c6c1f3510ec68e7116d))

## 2.1.9 - 2026-10-23

### Fixes

- Require vpndetection 5.10.1, which types every answer member ([`26c6392`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/26c6392b441a97bce01bc9248700101b6c480a12))

## 2.1.8 - 2026-10-20

### Features

- Require vpndetection 5.10.0: lookup results carry location and asn ([`324ebc7`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/324ebc76519f6945ac649262d9746a4332912e63))

### Fixes

- Forward an answer carrying a flag emoji or a currency sign ([`e757fb3`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/e757fb3a6c9d2d152a8ab792401f6e01f7085301))

## 2.1.7 - 2026-10-20

### Fixes

- Require vpndetection 5.9.0: oauth.register, and OAuth answers that are not JSON ([`0f389c8`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/0f389c854b8e64b5f64382da96080c11b9d8a024))

## 2.1.6 - 2026-10-20

### Fixes

- Require vpndetection 5.8.1: a batch entry is read by the answer's own keys ([`de3b773`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/de3b77381cd34fec0cb245089c1c1dafd756f51e))

## 2.1.5 - 2026-10-19

### Fixes

- Require vpndetection 5.8.0: num_ports and num_proxies in the pubproxy detail ([`8faa252`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/8faa2526ad75da83f2276c484922e8bdc2c1d3f8))

## 2.1.4 - 2026-10-18

### Fixes

- Require vpndetection 5.7.0: isPubproxy and the pubproxy detail ([`dca6ccd`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/dca6ccd2d9326972485b0c163136d0dac042e826))

## 2.1.3 - 2026-10-17

### Features

- Require vpndetection 5.6.0: OauthMetadata carries registration_endpoint ([`3bbbb47`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/3bbbb472a75ddfd64b64427bb1eb5bfea2ecc14c))

## 2.1.2 - 2026-10-16

### Fixes

- Require vpndetection 5.5.3: the spec re-pinned to 2026.10.15 ([`0695fae`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/0695fae2775da2dd1f590da4c12e9ac98d96b1d6))

## 2.1.1 - 2026-10-12

### Fixes

- Require vpndetection 5.5.2: an unreadable answer is retried, a blank key sends none ([`7f9b8e0`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/7f9b8e0fc29cf21faf68a7bd74f4633c01fb23f1))

## 2.1.0 - 2026-10-10

### Features

- Require vpndetection 5.5.1: the proxy builds on Next 15's Edge runtime ([`ea522cc`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/ea522cc4c5801afcf631e386e1d49ceffcb86a16))

## 2.0.9 - 2026-10-05

### Features

- Require vpndetection 5.4.0: the authorization code sign-in ([`60dccd9`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/60dccd904df1f4839ac67e31e90ad0c1bf3d6000))

## 2.0.8 - 2026-10-04

### Fixes

- Require vpndetection 5.3.4, re-pinned to spec 2026.10.03 ([`b88491e`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/b88491e6ab513378122da929dfc5096f7f5d512e))

## 2.0.7 - 2026-09-29

### Fixes

- Require vpndetection 5.3.3: 26 more reserved ranges are answered locally ([`d648986`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/d648986cc9f7e16ea4f6bffd0881679dfd00c5a2))

## 2.0.6 - 2026-09-28

### Fixes

- Require vpndetection 5.3.2: IPv4-mapped visitors are looked up, not waved through ([`5186994`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/51869945e61f621fb78b7903d4eb35067440b3f6))

## 2.0.5 - 2026-09-27

### Fixes

- Require vpndetection 5.3.1: no doubled slash, impossible timeouts refused, poll cut ([`1df0db2`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/1df0db27030a955cab7a15ee76946d4fa523d9a6))

## 2.0.4 - 2026-09-27

### Features

- Require vpndetection 5.3.0: OauthMetadata carries client_id_metadata_document_supported ([`2140f89`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/2140f891c1247681d888cbcba9fb4e93314e00e9))

## 2.0.3 - 2026-09-25

### Fixes

- Raise the base floor to vpndetection 5.2.2 ([`2778ab4`](https://github.com/vpndetection-io/sdk-nodejs-nextjs/commit/2778ab4e6deb70dd292d80328638f05bc12dedf5))
