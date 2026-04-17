async function test() {
  const lat = -33.35, lng = -68.33, radius = 20000;
  const query = \[out:json][timeout:15];(node["sport"="padel"](around:\,\,\);way["sport"="padel"](around:\,\,\);node["sport"="paddle"](around:\,\,\);way["sport"="paddle"](around:\,\,\);node["leisure"="pitch"]["sport"~"padel|paddle"](around:\,\,\);way["leisure"="pitch"]["sport"~"padel|paddle"](around:\,\,\););out center;\;
  
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });
  const data = await res.json();
  console.log('Total:', data.elements.length);
}
test();
