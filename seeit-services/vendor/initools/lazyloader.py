"""
**Deprecated** (13 Aug 2006)

A config file loader that can load and nest multiple config files, the
config files can have structure, and the values can be tracked back to
their original file and line number.

To start, you'd do something like:

    >>> config = LazyLoader()

You could use ``.load(filename)`` to load a config file; for the
examples it is convenient to instead use loadstring, and give a fake
filename:

    >>> config_data = \"\"\"
    ... [server]
    ... port = 8000
    ... host = localhost
    ... document_root = /var/www
    ... \"\"\"
    >>> config.loadstring(config_data, filename='config_data.conf')
    >>> config['server']['port']
    '8000'
    >>> config['server'].convert('port', int)
    8000
    >>> config['server'].convert('host', int)
    Traceback (most recent call last):
        ...
    ValueError: Error in config_data.conf (section [server]), line 4 ('localhost'):
    ValueError: invalid literal for int(): localhost

Note that names are normalized, removing case, underscores, and
spaces.  So to get to the document root:

    >>> config['server']['documentroot']
    '/var/www'

You can also merge in values; for instance, consider a virtual host
that overrides global values:

    >>> vhost_data = \"\"\"
    ... [vhost(my.host.com)]
    ... document_root = /path/to/root
    ... \"\"\"
    >>> vhost_config = LazyLoader()
    >>> vhost_config.loadstring(vhost_data, filename='vhost_data.conf')
    >>> vhost_config['vhost'].keys()
    ['my.host.com']

Note that key and section names can be nested with .'s, and ()'s quote
the values (so the key is ['my.host.com'] instead of
['my']['host']['com']).  Then we may want to merge this in, based on a
condition (e.g., the hostname matches my.host.com):

    >>> config['server'].merge(vhost_config['vhost']['my.host.com'])
    >>> config['server']['documentroot']
    '/path/to/root'

"""

# This was deprecated 13 Aug 2006
import warnings
warnings.warn('initools.lazyloader is not supported or recommended for use.',
              DeprecationWarning)

from lazyiniparser import LazyINIParser, Item
from nested import NestedDict
import inischema
import re
from UserDict import UserDict, DictMixin

class LazyLoader(NestedDict):

    def __init__(self, configs=None, mutable=False, nest=True,
                 section_name=None, master=None):
        self.section_name = section_name
        self.master = master
        NestedDict.__init__(self, configs=configs, mutable=mutable,
                            nest=nest)
        
    def load(self, filename):
        parser = LazyINIParser(allow_empty_sections=True)
        parser.load(filename)
        config = self._convert_configuration(parser.configuration)
        self.add_config(config)

    def loadstring(self, s, filename=None):
        parser = LazyINIParser(allow_empty_sections=True)
        parser.loadstring(s, filename=filename)
        config = self._convert_configuration(parser.configuration)
        self.add_config(config)

    def merge(self, lazyloader):
        if self.master:
            self.master._propagate_merge([self.section_name], lazyloader)
        else:
            self._propagate_merge([], lazyloader)

    def _propagate_merge(self, slave_keys, lazyloader):
        if self.master:
            slave_keys.insert(0, self.section_name)
            self.master._propagate_merge(slave_keys, lazyloader)
        else:
            configs = filter(None, lazyloader.configs)
            new_configs = []
            for config in configs:
                if slave_keys:
                    new_config = {}
                    set_config = new_config
                    for key in slave_keys[:-1]:
                        set_config[key] = {}
                        set_config = set_config[key]
                    set_config[slave_keys[-1]] = config
                else:
                    new_config = config
                self.add_config(new_config)

    def __getitem__(self, key):
        try:
            return NestedDict.__getitem__(self, key)
        except KeyError, e:
            if self.section_name is None:
                section = 'global section'
            else:
                section = 'section [%s]' % self.section_name
            raise KeyError(
                "Key %r not found in %s" % (key, section))

    def _convert_configuration(self, conf):
        data = {}
        for section in conf.sections:
            section_keys = self._parse_keys(section.name)
            if section_keys == ['global']:
                section_keys = []
            for item in section.items:
                item_keys = self._parse_keys(item.name)
                all_keys = section_keys + item_keys
                pos = data
                for key in all_keys[:-1]:
                    pos = pos.setdefault(key, {})
                pos.setdefault(all_keys[-1], []).append(item)
        return data

    def _parse_keys(self, name):
        keys = []
        orig_name = name
        name = name.strip()
        while 1:
            next_period = name.find('.')
            next_paren = name.find('(')
            if next_paren == -1 and next_period == -1:
                next = self._canonical_name(name)
                if next:
                    keys.append(next)
                return keys
            elif (next_paren == -1
                or next_period != -1 and next_period < next_paren):
                next = self._canonical_name(name[:next_period])
                if next:
                    keys.append(next)
                name = name[next_period+1:]
            else:
                assert next_paren != -1
                assert next_period == -1 or next_paren < next_period
                next = self._canonical_name(name[:next_paren])
                if next:
                    keys.append(next)
                name = name[next_paren+1:]
                next_close = name.find(')')
                if next_close == -1:
                    raise inischema.ParseValueError(
                        "Key name contains a ( with no closing ): %r"
                        % orig_name)
                next = name[:next_close]
                keys.append(next)
                name = name[next_close+1:]

    _canonical_re = re.compile('[_ \t-]')
    def _canonical_name(self, name):
        return self._canonical_re.sub('', name.lower())

    def _convert_single(self, key, value_list):
        if isinstance(value_list[0], (dict, DictMixin, UserDict)):
            return self.__class__(
                value_list, mutable=self.mutable, nest=True,
                section_name=key, master=self)
        elif isinstance(value_lue = self.__class__(
                        [item], mutable=self.mutable, nest=self.nest)
                elif isinstance(item, Item):
                    value = item.content
                else:
                    value = item
                converted.append(value)
        return converted

    def _make_converter(self, key, converter):
        if not isinstance(converter, inischema.opt):
            converter = inischema.optconverter.get_converter(
                key, converter_func=converter)
     ue = self.__class__(
                        [item], mutable=self.mutable, nest=self.nest)
                elif isinstance(item, Item):
                    value = item.content
                else:
                    value = item
                converted.append(value)
        return converted

    def _make_converter(self, key, converter):
        if not isinstance(converter, inischema.opt):
            converter = inischema.optconverter.get_converter(
                key, converter_func=converter)
        return converter

    def convert(self, key, converter):
        converter = self._make_converter(key, converter)
        try:
            return converter.convert(None, self[key])
        except inischema.ParseValueError, e:
            item = self.raw_get(key)[0][0]
            message = ('Error in %s (section [%s]), line %i (%r):\n%s'
                       % (item.filename, item.section.name, item.lineno,
                          self[key], e))
            raise ValueError(message)

    def convertlist(self, key, converter, add_inherited=True):
        converter = self._make_converter(key, converter)
        value_list = self.getlist(key, add_inherited=add_inherited)
        new_list = []
        try:
            for value in value_list:
                new_list.append(converter.convert(value))
        except inischema.ParseValueError, e:
            pass
        
        
