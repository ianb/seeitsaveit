"""
**Deprecated** (13 Aug 2006)
"""

# This was deprecated 13 Aug 2006
import warnings
warnings.warn('initools.configwrapper is not supported or recommended for use.',
              DeprecationWarning)


import os
import iniparser

class _ConfigParser(iniparser.INIParser):

    """
    An internal subclass of the abstract ini parser, which saves
    everything into one dictionary.
    """

    def __init__(self, allow_empty_sections=True):
        self.allow_empty_sections = allow_empty_sections
        iniparser.INIParser.__init__(self)

    def reset(self):
        self.data = {}
        self.key_order = {}
        self.section_order = []
        iniparser.INIParser.reset(self)

    def assignment(self, name, content):
        section = self.data.setdefault(self.section, {})
        name = clean_name(name)
        section.setdefault(name, []).append(content)
        self.key_order.setdefault(self.section, []).append(name)

    def new_section(self, section):
        section = section.strip().lower()
        if not section or section == 'general':
            section = None
        self.section = section
        if not section in self.section_order:
            self.section_order.append(section)

class NoDefault:
    pass

def clean_name(name):
    name = name.strip().lower()
    for char in ' \t_-':
        name = name.replace(char, '')
    return name

class Config(object):

    """
    A configuration object.  Acts a little like a dictionary, but not
    really.

    Configuration can be nested with ``[section]`` markers, or can be
    flat (everything globally available).  If in sections then
    ``section.key`` is used, otherwise just ``key``.
    """

    # If False, then no global sections are allowed
    allow_empty_sections = True

    def __init__(self, filename, file=None,
                 allow_empty_sections=NoDefault):
        if allow_empty_sections is not NoDefault:
            self.allow_empty_sections = allow_empty_sections
        self.filename = filename
        p = _ConfigParser(allow_empty_sections=self.allow_empty_sections)
        if file is None:
            p.load(filename)
        else:
            p.loadfile(file)
        self.raw_data = p.data
        self._section_order = p.section_order
        self._key_order = p.key_order
        self.name = os.path.splitext(os.path.basename(filename))[0]

    def keys(self, section=NoDefault):
        if section is NoDefault:
            all = []
            for section_name in self._section_order:
                for key_name in self._key_order[section_name]:
                    if section_name:
                        key_name = '%s|%s' % (section_name, key_name)
                    all.append(key_name)
            return all
        else:
            try:
                return self._key_order[section]
            except KeyError:
                raise KeyError(
                    "Section [%s] not found (from sections %r)"
                    %(section, self._key_order.keys()))

    def sections(self):
        return self._section_order

    def getraw(self, key, section=None):
        """
        Mostly for internal use, returns a list of all matching keys.
        """
        if '|' in key:
            assert section is None, (
                "Cannot have | in a key (%r) and an explicit section (%r)"
                % (key, section))
            section, key = key.split('|', 1)
        section = self.clean_section(section)
        try:
            return self.raw_data[section][key]
        except KeyError:
            return ()

    def clean_section(self, section_name):
        if not section_name or section_name == 'general':
            return None
        return section_name.lower()

    def get(self, key, default=None, section=None):
        """
        Get a single value, returning `default` if none found.
        """
        value = self.getraw(key, section=section)
        if not value:
            return default
        else:
            return value[0]

    def getlist(self, key, default=(), section=None):
        """
        Get a list of all matching keys.  Example::

          foo = bar
          foo = baz

        Then::

          >>> config.getlist('foo')
          ['bar', 'baz']
        """
        value = self.getraw(key, section=section)
        if not value:
            return default
        else:
            return value

    true_values = ['t', 'true', '1', 'y', 'yes', 'on']
    false_values = ['f', 'false', '0', 'n', 'no', 'off']

    def getbool(self, key, default=False, section=None):
        """
        Get a single boolean value.  Boolean values are things
        like ``true``, ``false``, etc.
        """
        value = self.getraw(key, section=section)
        if not value:
            return default
        value = value[0]
        if isinstance(value, (str, unicode)):
            value = value.lower()
            if value in self.true_values:
                return True
            elif value in self.false_values:
                return False
            else:
                raise ValueError(
                    "Yes/No value expected for %s (got %r)"
                    % (key, value))
        else:
            return value

    def getint(self, key, default=None, section=None):
        """
        Get an integer value.
        """
        v = self.get(key, default=default, section=section)
        if v is None:
            return v
        else:
            return int(v)
        
    def getinlinelist(self, key, default=(), section=None):
        """
        Get a list, where the list is defined like::

            foo = bar, baz

        Gives::

            >>> config.getinlinelist('foo')
            ['bar', 'baz']
        """
        result = []
        for item in self.getlist(key, default, section):
            item = item.strip()
            if not item:
                continue
            if ',' in item:
                result.extend([i.strip() for i in item.split(',')])
            else:
                result.append(item)
        return result

    def getstartswith(self, startswith, section):
        """
        Returns a list of ``[(key, value), ...]`` for all keys in the
        section that start with startswith.
        """
        result = []
        for key in self.keys(section=section):
            if not key.startswith(startswith):
                continue
            for value in self.getraw(key, section=section):
                result.append((key, value))
        return result

    def __repr__(self):
        return '<%s filename=%s>' % (
            self.__class__.__name__, self.filename)

    def __str__(self):
        data = []
        data.append('%s from %s:' % (
            self.__class__.__name__, self.filename))
        for name, value_list in self.raw_data.get(None, {}).items():
            for value in value_list:
                data.append('%s: %s' % (name, value))
        for section_name, value_dict in self.raw_data.items():
            if section_name is None:
                continue
            data.append('[%s]' % section_name)
            for name, value_list in value_dict.items():
                for value in value_list:
                    data.append('%s: %s' % (name, value))
        return '\n'.join(data)
                
def load_options(parser, options, config, if_exists=True):
    """
    Given a parser object and the parsed options and a configuration
    object or filename, this will load the configuration into the
    parsed options.
    """
    types = {}
    dests = {}
    aliases = {}
    for option in parser.option_list:
        if not option.dest:
            # Some builtin options, like --help
            continue
        name = clean_name(option.dest)
        dests[name] = option.dest
        if option.action in ('store_true', 'store_false'):
            types[name] = 'getbool'
        else:
            types[name] = 'get'
        for lst in option._long_opts, option._short_opts:
            for opt in lst:
                aliases[clean_name(opt)] = name
    if isinstance(config, str):
        if if_exists and not os.path.exists(config):
            return
        config = Config(config)
    for config_key in config.keys():
        name = aliases.get(config_key, config_key)
        if name not in dests:
            raise ValueError(
                "Bad configuration file: option %r unexpected" % config_key)
        value = getattr(config, types[name])(config_key)
        setattr(options, dests[name], value)

        
