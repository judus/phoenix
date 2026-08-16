import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '../src/components/button'
import { ControlContext } from '../src/components/control-context'
import { Field, NumberInput, Select, Textarea, TextInput } from '../src/components/field'
import { Form, FormActionGroup, FormActions, FormGrid, FormSection } from '../src/components/form'
import { Stack } from '../src/components/layout'
import '../src/styles/control-stories.css'

function FormSystem() {
  return (
    <main className="control-story">
      <Stack gap="xl">
        <Stack gap="xs">
          <h1>Forms</h1>
          <p className="text-muted">Shared fields, states, responsive layout, and action structure.</p>
        </Stack>

        <ControlContext context="panel">
          <Form onSubmit={(event) => event.preventDefault()}>
            <FormSection
              title="Request scope"
              description="Group fields by the decision they affect, not merely by input type."
            >
              <FormGrid minimum="lg">
                <Field htmlFor="form-text" label="Reference" required>
                  <TextInput defaultValue="Col 285 Sector OK-C B14-5" />
                </Field>
                <Field htmlFor="form-number" label="Maximum distance">
                  <NumberInput defaultValue={100} min={0} />
                </Field>
                <Field htmlFor="form-select" label="Category">
                  <Select defaultValue="any">
                    <option value="any">Any category</option>
                    <option value="high-tech">High tech</option>
                    <option value="extraction">Extraction</option>
                  </Select>
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection
              title="Field states"
              description="Supporting guidance, validation, disabled values, and longer input remain part of the same system."
            >
              <FormGrid minimum="lg">
                <Field htmlFor="form-guided" label="Guided input" hint="Optional supporting guidance.">
                  <TextInput defaultValue="Known value" />
                </Field>
                <Field htmlFor="form-required" label="Invalid input" required error="Enter a valid value.">
                  <TextInput placeholder="Required value" />
                </Field>
                <Field htmlFor="form-disabled" label="Unavailable input">
                  <TextInput disabled value="Unavailable" readOnly />
                </Field>
                <Field htmlFor="form-textarea" label="Operational notes">
                  <Textarea defaultValue="Optional notes remain concise and task focused." />
                </Field>
              </FormGrid>
            </FormSection>

            <FormActions layout="columns">
              <FormActionGroup columns="two">
                <Button alignment="start" variant="outline" size="lg" type="button">Back</Button>
                <Button alignment="start" variant="outline" size="lg" type="reset">Reset</Button>
              </FormActionGroup>
              <Button alignment="start" variant="accent" size="lg" type="submit">Submit request</Button>
            </FormActions>
          </Form>
        </ControlContext>
      </Stack>
    </main>
  )
}

const meta = {
  title: 'Components/Forms',
  component: FormSystem,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof FormSystem>

export default meta
type Story = StoryObj<typeof meta>

export const System: Story = {}
