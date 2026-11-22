# The live block

This is the round 12 Tandem eval block, reformatted by the repository formatter but otherwise unedited. Switch the viewer between light and dark to see it adapt; the cards, borders, headings, and notes all follow the theme.

```html
<style>
  .dx-pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    color: #17222d;
    font: 14px/1.55 system-ui;
  }
  .dx-pair section {
    min-width: 0;
    border: 1px solid #d6e0e5;
    border-radius: 12px;
    background: #f7f9fa;
    padding: 16px;
  }
  .dx-pair h3 {
    margin: 0 0 12px;
    font-size: 15px;
  }
  .dx-pair pre {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font:
      12px/1.65 ui-monospace,
      monospace;
    tab-size: 2;
  }
  .dx-pair p {
    margin: 12px 0 0;
    color: #405360;
  }
  @media (max-width: 650px) {
    .dx-pair {
      grid-template-columns: 1fr;
    }
  }
</style>
<div class="dx-pair">
  <section>
    <h3>Supabase · fetch, then render</h3>
    <pre><code>const [todos, setTodos] = useState&lt;Todo[]&gt;([]);
const [error, setError] = useState&lt;string&gt;();

async function refresh() {
  const { data, error } = await supabase
    .from("todos").select("id,text,complete")
    .eq("complete", false);
  if (error) { setError(error.message); return; }
  setError(undefined);
  setTodos(data ?? []);
}

useEffect(() =&gt; { void refresh(); }, []);
return &lt;TodoList todos={todos} complete={complete} /&gt;;</code></pre>
    <p>
      1. Mount starts a network request.<br />2. Its result becomes component
      state.<br />3. Later changes need a refresh or reconciliation.
    </p>
  </section>
  <section>
    <h3>Tandem · query local state</h3>
    <pre><code>// Typed aliases, not TanStack Query:
const useQuery: UseTandemQuery&lt;TodoSchema&gt; =
  useTandemQuery;
const useTransaction:
  UseTandemTransaction&lt;TodoSchema&gt; =
  useTandemTransaction;

// Inside the component:
const todos = useQuery({
  collection: "todos",
  where: { complete: false },
}) ?? [];

return &lt;TodoList todos={todos} complete={complete} /&gt;;</code></pre>
    <p>
      1. Read the current local result.<br />2. The hook subscribes to that
      query.<br />3. Sync fills or updates the local view.
    </p>
  </section>
</div>
```
