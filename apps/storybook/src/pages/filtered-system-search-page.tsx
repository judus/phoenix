import { Button } from '../components/button'
import { ControlContext } from '../components/control-context'
import { Field, NumberInput, Select, TextInput } from '../components/field'
import { Form, FormActionGroup, FormActions, FormGrid, FormSection } from '../components/form'
import { Breadcrumbs, PageFrame, PageHeader } from '../components/page'
import './filtered-system-search-page.css'

export function FilteredSystemSearchPage() {
  return (
    <PageFrame layout="fit">
      <div className="filtered-system-search">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy intelligence', href: '#galaxy' }, { label: 'Query console' }]} />}
          status="Reference system resolved · Community reports may be incomplete or stale"
          title="Filtered system search"
        />

        <ControlContext context="panel">
          <Form onSubmit={(event) => event.preventDefault()}>
            <div className="query-workspace">
              <aside className="query-envelope" aria-label="Current search envelope">
                <header>
                  <small>Search envelope</small>
                  <strong>100 <span>LY</span></strong>
                  <p>from Col 285 Sector OK-C b14-5</p>
                </header>
                <dl>
                  <div>
                    <dt>Population</dt>
                    <dd>Any</dd>
                  </div>
                  <div>
                    <dt>Profile filters</dt>
                    <dd>Unrestricted</dd>
                  </div>
                  <div>
                    <dt>Data source</dt>
                    <dd>Community cartography</dd>
                  </div>
                </dl>
                <p>Results are ordered by distance from the reference system. Unknown values remain visible.</p>
              </aside>

              <div className="query-parameters">
                <FormSection
                  title="Search volume"
                  description="Set the origin, reach, and inhabited-state boundary."
                >
                  <FormGrid>
                    <Field htmlFor="query-reference-system" label="Reference system" required>
                      <TextInput defaultValue="Col 285 Sector OK-C b14-5" />
                    </Field>
                    <Field htmlFor="query-maximum-distance" label="Maximum distance">
                      <NumberInput defaultValue={100} min={1} />
                    </Field>
                    <Field htmlFor="query-population" label="Population">
                      <Select defaultValue="any">
                        <option value="any">Any population</option>
                        <option value="populated">Populated systems</option>
                        <option value="unpopulated">Unpopulated systems</option>
                      </Select>
                    </Field>
                  </FormGrid>
                </FormSection>

                <FormSection
                  title="System profile"
                  description="Narrow the political and economic profile. Leave fields unrestricted to broaden the search."
                >
                  <FormGrid>
                    <Field htmlFor="query-economy" label="Primary economy">
                      <Select defaultValue="any">
                        <option value="any">Any economy</option>
                        <option value="high-tech">High tech</option>
                        <option value="extraction">Extraction</option>
                        <option value="industrial">Industrial</option>
                      </Select>
                    </Field>
                    <Field htmlFor="query-allegiance" label="Allegiance">
                      <Select defaultValue="any">
                        <option value="any">Any allegiance</option>
                        <option value="alliance">Alliance</option>
                        <option value="empire">Empire</option>
                        <option value="federation">Federation</option>
                        <option value="independent">Independent</option>
                      </Select>
                    </Field>
                    <Field htmlFor="query-government" label="Government">
                      <Select defaultValue="any">
                        <option value="any">Any government</option>
                        <option value="anarchy">Anarchy</option>
                        <option value="corporate">Corporate</option>
                        <option value="democracy">Democracy</option>
                        <option value="dictatorship">Dictatorship</option>
                      </Select>
                    </Field>
                    <Field htmlFor="query-security" label="Security">
                      <Select defaultValue="any">
                        <option value="any">Any security</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="anarchy">Anarchy</option>
                      </Select>
                    </Field>
                  </FormGrid>
                </FormSection>

                <FormActions className="query-actions" layout="columns">
                  <FormActionGroup columns="two">
                    <Button alignment="start" variant="outline" size="lg" type="button">Back</Button>
                    <Button alignment="start" variant="outline" size="lg" type="reset">Reset filters</Button>
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
