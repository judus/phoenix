import {
  Breadcrumbs,
  Button,
  ControlContext,
  Field,
  Form,
  FormActionGroup,
  FormActions,
  FormGrid,
  NumberInput,
  PageFrame,
  PageHeader,
  Select,
  TextInput
} from '@phoenix/ui'

export function SystemSearchPage() {
  return (
    <PageFrame layout="fit">
      <div className="galaxy-query-editor">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#galaxy' }, { label: 'Query console' }]} />}
          status="Community reports may be incomplete or stale"
          title="System search"
        />

        <ControlContext context="panel" density="compact">
          <Form onSubmit={(event) => event.preventDefault()}>
            <div className="query-workspace">
              <aside className="query-envelope" aria-label="Current query">
                <header>
                  <small>Cartography</small>
                  <strong>System search</strong>
                  <p>from Col 285 Sector OK-C b14-5</p>
                </header>
                <dl>
                  <div><dt>Parameters</dt><dd>9</dd></div>
                  <div><dt>Data source</dt><dd>Community intelligence</dd></div>
                </dl>
                <p>Find nearby systems, optionally narrowed by demographic, economic, and political characteristics.</p>
              </aside>

              <div className="query-parameters">
                <div className="query-fields">
                  <FormGrid>
                    <Field htmlFor="query-origin" label="Reference system" required>
                      <TextInput id="query-origin" defaultValue="Col 285 Sector OK-C b14-5" />
                    </Field>
                    <Field htmlFor="query-radius" label="Maximum distance (ly)" required>
                      <NumberInput id="query-radius" defaultValue={100} min={1} max={500} />
                    </Field>
                    <Field htmlFor="query-population" label="Population">
                      <Select id="query-population" defaultValue="any">
                        <option value="any">Any</option>
                        <option value="inhabited">Inhabited</option>
                        <option value="uninhabited">Uninhabited</option>
                      </Select>
                    </Field>
                    <Field htmlFor="query-minimum-population" label="Minimum population">
                      <NumberInput id="query-minimum-population" min={0} />
                    </Field>
                    <Field htmlFor="query-maximum-population" label="Maximum population">
                      <NumberInput id="query-maximum-population" min={0} />
                    </Field>
                    {['Primary economy', 'Allegiance', 'Government', 'Security'].map(label => {
                      const id = `query-${label.toLocaleLowerCase().replace(' ', '-')}`
                      return <Field htmlFor={id} key={label} label={label}><Select id={id} defaultValue="any"><option value="any">Any</option></Select></Field>
                    })}
                  </FormGrid>
                </div>
                <FormActions className="query-actions" layout="columns">
                  <FormActionGroup columns="two">
                    <Button alignment="start" variant="outline" size="lg" type="button">Back</Button>
                    <Button alignment="start" variant="outline" size="lg" type="reset">Reset query</Button>
                  </FormActionGroup>
                  <Button alignment="start" variant="accent" size="lg" type="submit">Execute query</Button>
                </FormActions>
              </div>
            </div>
          </Form>
        </ControlContext>
      </div>
    </PageFrame>
  )
}
