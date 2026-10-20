import { linkedin } from './linkedin';
import { indeed } from './indeed';
import { greenhouse } from './greenhouse';
import { lever } from './lever';
import { handshake } from './handshake';

export function extractorFor(hostname: string) {
  const domains = [['linkedin.com', linkedin], ['indeed.com', indeed], ['greenhouse.io', greenhouse], ['lever.co', lever], ['joinhandshake.com', handshake]] as const;
  return domains.find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`))?.[1];
}
