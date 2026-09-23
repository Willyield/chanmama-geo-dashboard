(() => {
  'use strict';
  const base = new URL('../', document.currentScript.src);
  const cache = new Map();
  const searches = new Map();
  window.CQQ = {
    config: window.CQQ_PAYLOAD,
    async load(relative) {
      if (!cache.has(relative)) {
        const pending = fetch(new URL(relative, base), {cache:'force-cache'}).then(r => {
          if (!r.ok) throw new Error(`数据响应 ${r.status}`);
          return r.json();
        }).catch(error => { cache.delete(relative); throw error; });
        cache.set(relative,pending);
      }
      return cache.get(relative);
    },
    async list(kind,type) {
      const payload = await this.load(this.config[kind][type]);
      return kind === 'data' ? payload : payload.rows.map(values => Object.fromEntries(payload.keys.map((k,i)=>[k,values[i]])));
    },
    async search(type) {
      if (!searches.has(type)) searches.set(type, await this.load(this.config.search[type]));
    },
    searchText(id) {
      for (const rows of searches.values()) if (Object.hasOwn(rows,id)) return rows[id];
      return '';
    },
    async answer(id) { const routes=await this.load(this.config.details);return (await this.load(routes[id]))[id]; }
  };
})();
