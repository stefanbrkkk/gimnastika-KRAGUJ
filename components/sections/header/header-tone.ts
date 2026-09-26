/**
 * Header tone before the first paint (MD4-02).
 *
 * The header is server-rendered dark (the hero is under it on a plain first visit).
 * A deep link (/#uspesi), a reload or a history arrival can land anywhere, and
 * HeaderBehavior's IntersectionObserver only corrects the tone after hydration, which
 * the deferred scripts (D-23) put well after the first paint: the bar would paint navy
 * over a white section and snap to white half a second later.
 *
 * Two inline scripts keep the tone equal to the section under the bar in every painted
 * frame until HeaderBehavior takes over. Both do nothing on a plain first visit (no #hash,
 * navigation type „navigate“) and without JS; any error leaves the header as it was.
 *
 * HEADER_TONE_SCRIPT — the last child of the header, so it runs before any section is
 * parsed. It applies HeaderBehavior's rules at the current scroll position:
 * - band line: the bar's resting centre (offsetTop + offsetHeight / 2); cap line: the
 *   middle of the gap above it (offsetTop / 2), both rounded as in HeaderBehavior.
 * - picking (pickUnder): a [data-header-band][data-theme] inside main that contains the
 *   line wins; otherwise the last top-level themed block (main [data-theme] or the
 *   footer, not nested in another themed element) that contains it.
 * - data-theme: light | dark | darker (toneOf, darker keeps its navy-900 bar);
 *   data-cap-tone: the raw theme under the cap line (what HeaderBehavior writes).
 * It does not measure anything while it is parsed. It runs on every ResizeObserver
 * delivery for the root element and on every scroll event, until HeaderBehavior
 * dispatches HEADER_TONE_OWNED:
 * - Chromium restores a reload / history position as soon as the parsed page is tall
 *   enough and can paint it before parsing ends; the document grew in that layout, and
 *   ResizeObserver is delivered after it and before its paint.
 * - WebKit's and Firefox's fragment scroll and late restore come in a task after
 *   parsing; the scroll event is dispatched before the next paint.
 * So the hero keeps its navy bar while it is on screen, and the landing frame has the
 * landing tone.
 *
 * HEADER_LAND_SCRIPT — at the end of the footer, when every section is parsed; the
 * header's script then measures once:
 * - a deep link: Chromium does its fragment scroll in that forced layout, outside a
 *   frame, so the tone is the landing's before the landing is painted (left to its own
 *   frame, the scroll was painted one frame before its scroll event: a navy bar over the
 *   white section for one frame). The page is never scrolled from script: that cancels
 *   WebKit's fragment anchoring, and the landing then drifts with late layout (web
 *   fonts) instead of following the target.
 * - a reload or history arrival without a #hash that the browser has not restored yet
 *   (WebKit and Firefox restore after parsing and painted the hero first): it first moves to the position HeaderBehavior stored on pagehide
 *   for this history entry (Navigation API key; one slot where there is none) at the
 *   same viewport width, so the first paint is already the restored position; the
 *   browser's own restore then finds the page there. With a #hash, WebKit and Firefox go
 *   to the fragment even on a reload, so the stored position is not used then.
 * data-cap (the cap's on/off fade) is left to HeaderBehavior.
 */

/**
 * sessionStorage key prefix: `${HEADER_Y_KEY}:<navigation.currentEntry.key>` (or the bare
 * prefix without the Navigation API) → "<scrollY> <innerWidth>", written by HeaderBehavior
 * on pagehide.
 */
export const HEADER_Y_KEY = "kraguj:header-y";
/** Event HeaderBehavior dispatches on [data-site-header] when its observers own the tone. */
export const HEADER_TONE_OWNED = "kraguj:tone-owned";
/** Event the footer's script dispatches on [data-site-header] once every section is parsed. */
export const HEADER_TONE_LAND = "kraguj:tone-land";

/** The storage key for the current history entry (the same expression runs in the script). */
export const headerYKey = (entryKey: string | null | undefined): string =>
  entryKey ? `${HEADER_Y_KEY}:${entryKey}` : HEADER_Y_KEY;

export const HEADER_TONE_SCRIPT = `(function(){try{var d=document,h=d.querySelector("[data-site-header]"),b=h&&h.querySelector("[data-header-bar]");if(!b)return;var n=performance.getEntriesByType("navigation")[0],t=n&&n.type,back=t==="reload"||t==="back_forward";if(!location.hash&&!back)return;var under=function(L){var bands=d.querySelectorAll("main [data-header-band][data-theme]"),secs=d.querySelectorAll("main [data-theme], footer[data-theme]"),p=null,e,r,i;for(i=0;i<bands.length;i++){r=bands[i].getBoundingClientRect();if(r.top<=L&&r.bottom>L)return bands[i]}for(i=0;i<secs.length;i++){e=secs[i];if(e.hasAttribute("data-header-band")||(e.parentElement&&e.parentElement.closest("[data-theme]")))continue;r=e.getBoundingClientRect();if(r.top<=L&&r.bottom>L)p=e}return p};var tone=function(){var u=under(Math.round(b.offsetTop+b.offsetHeight/2)),c=under(Math.round(b.offsetTop/2)),v;if(u){v=u.getAttribute("data-theme");v=v==="darker"?"darker":v==="dark"?"dark":"light";if(h.getAttribute("data-theme")!==v)h.setAttribute("data-theme",v)}if(c){v=c.getAttribute("data-theme");if(v&&h.getAttribute("data-cap-tone")!==v)h.setAttribute("data-cap-tone",v)}};var live=function(){try{tone()}catch(x){}},ro=null;try{ro=new ResizeObserver(live);ro.observe(d.documentElement)}catch(x){}addEventListener("scroll",live,{passive:true});h.addEventListener("${HEADER_TONE_OWNED}",function(){if(ro)ro.disconnect();removeEventListener("scroll",live)});h.addEventListener("${HEADER_TONE_LAND}",function(){try{if(!location.hash&&back&&!(scrollY>0)){var s,nk="";try{nk=navigation.currentEntry.key||""}catch(x){}s=(sessionStorage.getItem("${HEADER_Y_KEY}"+(nk?":"+nk:""))||"").split(" ");if(s.length===2&&+s[1]===innerWidth&&+s[0]>0)scrollTo({top:+s[0],behavior:"instant"})}tone()}catch(x){}})}catch(x){}})();`;

export const HEADER_LAND_SCRIPT = `(function(){try{var h=document.querySelector("[data-site-header]");if(h)h.dispatchEvent(new Event("${HEADER_TONE_LAND}"))}catch(x){}})();`;
