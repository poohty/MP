import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// Recipe sites bot-block plain fetch() from the app (Cloudflare/Akamai). A real
// (hidden) WebView passes those checks, so pages are loaded through this host.
export type FetchedRecipePage = {
  recipeJson?: string;
  text: string;
  title: string;
  blocked: boolean;
};

type Job = { url: string; resolve: (r: FetchedRecipePage | null) => void };

const HARD_TIMEOUT_MS = 22000;
const MAX_TEXT = 30000;
const MAX_JSON = 40000;

const INJECT = `
(function(){
  var start = Date.now();
  function analyze(){
    var out = { title: document.title, text: document.body ? document.body.innerText.slice(0, ${MAX_TEXT}) : '', recipeJson: '', blocked: false };
    var best = null;
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function(b){
      try {
        (function visit(n){
          if(!n||typeof n!=='object') return;
          if(Array.isArray(n)){ n.forEach(visit); return; }
          var t = n['@type']; var ts = Array.isArray(t)?t:[t];
          if(ts.some(function(x){return typeof x==='string' && x.toLowerCase()==='recipe';}) && n.recipeIngredient && n.recipeInstructions){
            var s = JSON.stringify(n);
            if(!best || s.length > best.length) best = s;
          }
          if(n['@graph']) visit(n['@graph']);
        })(JSON.parse(b.textContent));
      } catch(e){}
    });
    if (best) out.recipeJson = best.slice(0, ${MAX_JSON});
    var probe = (document.title + ' ' + out.text.slice(0, 600)).toLowerCase();
    out.blocked = /just a moment|attention required|access denied|verify you are human|are you a robot|captcha|unusual traffic|request blocked/.test(probe);
    return out;
  }
  var iv = setInterval(function(){
    try {
      var o = analyze(); var waited = Date.now() - start;
      var done = o.recipeJson || (waited > 6000 && !o.blocked) || waited > 15000;
      if (done) { clearInterval(iv); window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
    } catch(e){}
  }, 500);
})(); true;
`;

const queue: Job[] = [];
let active = false;
let startJob: ((job: Job | null) => void) | null = null;

function pump(): void {
  if (active || !startJob || queue.length === 0) return;
  active = true;
  startJob(queue.shift() ?? null);
}

export function fetchRecipePage(url: string): Promise<FetchedRecipePage | null> {
  return new Promise((resolve) => {
    queue.push({ url, resolve });
    pump();
  });
}

// Mount once near the app root. Renders nothing visible.
export function RecipePageFetcherHost(): React.ReactElement | null {
  const [job, setJob] = useState<Job | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    startJob = (j) => {
      finished.current = false;
      setJob(j);
    };
    pump();
    return () => {
      startJob = null;
    };
  }, []);

  const finish = (result: FetchedRecipePage | null): void => {
    if (finished.current || !job) return;
    finished.current = true;
    job.resolve(result);
    active = false;
    setJob(null);
    pump();
  };

  useEffect(() => {
    if (!job) return;
    const t = setTimeout(() => finish(null), HARD_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  if (!job) return null;

  return (
    <WebView
      key={job.url}
      source={{ uri: job.url }}
      incognito
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={(req) => /^(https?:|about:)/i.test(req.url)}
      injectedJavaScript={INJECT}
      onMessage={(e) => {
        try {
          finish(JSON.parse(e.nativeEvent.data) as FetchedRecipePage);
        } catch {
          finish(null);
        }
      }}
      onError={() => finish(null)}
      style={styles.hidden}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  // Positioned off-screen entirely (not just zero-size/opacity) so a device that briefly
  // renders the WebView at its natural page size before applying layout never shows it.
  hidden: { position: 'absolute', width: 300, height: 300, top: -9999, left: -9999, opacity: 0 },
});
