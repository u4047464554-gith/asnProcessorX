import os
import asn1tools
import glob
from typing import Dict, Optional, List

class AsnManager:
    def __init__(self, specs_dir: str = "asn_specs"):
        # If running from backend/, specs might be in ../asn_specs
        if not os.path.exists(specs_dir) and os.path.exists(os.path.join("..", specs_dir)):
            self.specs_dir = os.path.join("..", specs_dir)
        else:
            self.specs_dir = specs_dir
            
        self.compilers: Dict[str, asn1tools.compiler.Specification] = {}
        self.ensure_specs_dir()
        
    def ensure_specs_dir(self):
        if not os.path.exists(self.specs_dir):
            os.makedirs(self.specs_dir)

    def load_protocols(self):
        """
        Scans the specs directory. Each subdirectory is treated as a 'Protocol'.
        Compiles all .asn files in that subdirectory.
        """
        if not os.path.exists(self.specs_dir):
            return

        # List subdirectories
        subdirs = [d for d in os.listdir(self.specs_dir) 
                   if os.path.isdir(os.path.join(self.specs_dir, d))]

        for protocol in subdirs:
            proto_path = os.path.join(self.specs_dir, protocol)
            asn_files = glob.glob(os.path.join(proto_path, "*.asn"))
            
            if asn_files:
                print(f"Compiling protocol: {protocol} with files: {asn_files}")
                try:
                    # Compile with all codecs to support runtime switching if possible, 
                    # but asn1tools compile_files usually takes a codec.
                    # We will default to 'per' for compilation or store the specification object 
                    # which can be used for encoding/decoding with different rules if supported.
                    # Actually asn1tools.compile_files returns a Specification object.
                    # We typically need to specify the codec at compile time or use the 'per' codec for PER.
                    # Let's compile specifically for PER as requested by the user for now, 
                    # or better: just compile without specifying codec if we want the generic model, 
                    # but asn1tools usually wants a codec for some operations. 
                    # Wait, asn1tools.compile_files(..., codec='per') is common. 
                    # Let's try to support multiple codecs by storing the file paths or re-compiling on demand?
                    # Re-compiling is fast enough for MVP. 
                    # Let's store the compiled object for 'per' (aligned) as default.
                    
                    # Note: 'uoer' is Unaligned PER. 'per' is Aligned PER.
                    self.compilers[protocol] = asn1tools.compile_files(asn_files, codec='per')
                    print(f"Successfully compiled {protocol}")
                except Exception as e:
                    print(f"Error compiling {protocol}: {e}")

    def get_compiler(self, protocol: str) -> Optional[asn1tools.compiler.Specification]:
        return self.compilers.get(protocol)

    def reload(self):
        self.compilers.clear()
        self.load_protocols()

    def list_protocols(self) -> List[str]:
        return list(self.compilers.keys())

# Singleton instance
manager = AsnManager()

