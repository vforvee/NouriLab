# Data dictionary
Record one observation per sample, property, method and source context.

## Ingredient
`id`, `name`, `scientific_name`, `category`, `origin`, `description`.

## Sample (recommended extension)
`sample_id`, `ingredient_id`, `variety`, `processing_form`, `extraction_method`, `drying_method`, `defatting_method`, `processing_conditions`.

## Functional observation (recommended extension)
`observation_id`, `sample_id`, `property_name`, `value`, `unit`, `method`, `pH`, `temperature_c`, `replicate_count`, `standard_deviation`, `source_id`, `provenance_type`.

## Provenance types
`measured`, `literature`, `nutrition_database`, `imputed`, `predicted`, `screening_estimate`.

Keep unavailable values as null, not zero. Flour, concentrate and isolate records must remain distinct. Document DOI/source, units and analytical method.
