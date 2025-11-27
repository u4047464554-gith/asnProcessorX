import { createTheme, type MantineThemeOverride } from '@mantine/core';

export const starTrekTheme: MantineThemeOverride = createTheme({
  primaryColor: 'cyan',
  defaultRadius: 0, // Sharp corners
  fontFamily: 'Verdana, Geneva, sans-serif', 
  headings: {
    fontFamily: 'Verdana, Geneva, sans-serif',
    fontWeight: 'bold',
  },
  components: {
    Title: {
        styles: {
            root: {
                textTransform: 'uppercase',
                letterSpacing: '2px',
                color: '#FFD43B', // Bright Gold/Yellow Title
            }
        }
    },
    Button: {
        defaultProps: {
            variant: 'filled',
            radius: 0, 
        },
        styles: {
            root: {
                textTransform: 'uppercase',
                fontWeight: 'bold',
                letterSpacing: '1px',
                backgroundColor: '#22B8CF', // Cyan 6 (Bright)
                color: '#000',
                border: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                    backgroundColor: '#FFD43B', // Bright Gold on Hover
                    color: '#000',
                    transform: 'scale(1.05)',
                    boxShadow: '0 0 15px #FFD43B', // Golden Glow
                }
            }
        }
    },
    Paper: {
        defaultProps: {
            radius: 0,
            withBorder: false, 
        },
        styles: {
            root: {
                backgroundColor: '#000000',
                // LCARS Style Frame - Brighter
                borderLeft: '22px solid #3BC9DB', // Cyan 5 (Even Brighter)
                borderTop: '2px solid #3BC9DB', 
                borderBottom: '2px solid #3BC9DB', 
                borderRight: '2px solid #3BC9DB', 
                position: 'relative',
                overflow: 'hidden',
            }
        }
    },
    AppShell: {
        styles: {
            main: {
                backgroundColor: '#000000',
                color: '#E3FAFC', // Cyan 1 (Very light text)
            },
            header: {
                backgroundColor: '#000000',
                borderBottom: '6px solid #3BC9DB', // Matching bright border
                borderTop: '2px solid #3BC9DB',
            }
        }
    },
    Input: {
        defaultProps: {
            radius: 0,
        },
        styles: {
            input: {
                backgroundColor: '#050505',
                color: '#66D9E8', // Cyan 4 (Bright text)
                borderColor: '#22B8CF', // Cyan 6
                borderWidth: '2px',
                borderRadius: 0,
                '&:focus': {
                    borderColor: '#FFD43B', // Gold Focus
                },
                '&::placeholder': {
                    color: '#1098AD' // Cyan 7
                }
            },
            label: {
                color: '#3BC9DB', // Cyan 5
                textTransform: 'uppercase',
                fontWeight: 'bold',
                marginBottom: '4px'
            }
        }
    },
    Textarea: {
        defaultProps: {
            radius: 0,
        },
        styles: {
            input: {
                backgroundColor: '#050505',
                color: '#66D9E8',
                borderColor: '#22B8CF',
                borderWidth: '2px',
                borderRadius: 0,
                fontFamily: 'Consolas, monospace',
                '&:focus': {
                    borderColor: '#FFD43B', 
                }
            },
            label: {
                color: '#3BC9DB',
                textTransform: 'uppercase',
                fontWeight: 'bold'
            }
        }
    },
    JsonInput: {
        defaultProps: {
            radius: 0,
        },
        styles: {
            input: {
                backgroundColor: '#050505',
                color: '#66D9E8',
                borderColor: '#22B8CF',
                borderWidth: '2px',
                borderRadius: 0,
                fontFamily: 'Consolas, monospace',
                '&:focus': {
                    borderColor: '#FFD43B', 
                }
            },
            label: {
                color: '#3BC9DB',
                textTransform: 'uppercase',
                fontWeight: 'bold'
            }
        }
    },
    Select: {
        defaultProps: {
            radius: 0,
        },
        styles: {
            input: {
                backgroundColor: '#050505',
                color: '#66D9E8',
                borderColor: '#22B8CF',
                borderWidth: '2px',
                borderRadius: 0,
            },
            dropdown: {
                backgroundColor: '#000000',
                borderColor: '#3BC9DB',
                borderRadius: 0,
            },
            option: {
                color: '#66D9E8',
                borderRadius: 0,
                '&[data-hovered]': {
                    backgroundColor: '#3BC9DB',
                    color: '#000'
                },
                '&[data-selected]': {
                    backgroundColor: '#FFD43B',
                    color: '#000'
                }
            },
            label: {
                color: '#3BC9DB',
                textTransform: 'uppercase',
                fontWeight: 'bold'
            }
        }
    },
    ActionIcon: {
        defaultProps: {
            radius: 0,
            variant: 'filled'
        },
        styles: {
            root: {
                backgroundColor: '#3BC9DB',
                color: 'black',
                '&:hover': {
                    backgroundColor: '#FFD43B',
                }
            }
        }
    }
  }
});

export const defaultTheme: MantineThemeOverride = createTheme({
    primaryColor: 'blue',
    defaultRadius: 'sm',
});

export const themes: Record<string, MantineThemeOverride> = {
    'Default': defaultTheme,
    'Star Trek (LCARS)': starTrekTheme,
};
