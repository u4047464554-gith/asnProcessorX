import asn1tools
import os

# Compile the simple schema
schema_path = os.path.join("asn_specs", "simple_demo", "simple.asn")
s = asn1tools.compile_files([schema_path], codec='per')

# Encode a Person
data = {
    'name': 'Alice',
    'age': 30,
    'isAlive': True
    # secret is optional, omitted
}
encoded = s.encode('Person', data)
print(f"Hex: {encoded.hex()}")

# Verify decode
decoded = s.decode('Person', encoded)
print(f"Decoded: {decoded}")

