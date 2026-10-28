import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isVerificationYes, isVerificationStop } from '../_shared/contactVerificationInbound.ts';
for (const reply of ['YES','Y','yes','yeah','ok','confirmed']) {
 Deno.test(`confirms explicit reply ${reply}`,()=>assertEquals(isVerificationYes(reply),true));
}
Deno.test('YES with refusal is not confirmation',()=>assertEquals(isVerificationYes('YES but wrong number'),false));
Deno.test('STOP is never YES',()=>assertEquals(isVerificationYes('STOP'),false));
Deno.test('STOPALL is suppression',()=>assertEquals(isVerificationStop('STOPALL'),true));
Deno.test('case and whitespace preserve STOP',()=>assertEquals(isVerificationStop(' stop '),true));
